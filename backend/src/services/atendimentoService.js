import { ESTADOS, podeTransitar, rotuloEstado } from '../domain/estados.js';
import { escolherProximoTipo } from '../domain/prioridade.js';
import { conflito, naoEncontrado, proibido } from '../utils/erros.js';
import { dataLocal } from '../utils/tempo.js';
import { senhaParaDto } from '../utils/dto.js';

/**
 * Casos de uso do agente atendente (AA): chamar próxima, chamar novamente,
 * iniciar, finalizar e marcar não comparecimento.
 *
 * Todas as operações rodam dentro de repo.comTrava(): o banco serializa os
 * atendentes que agem "praticamente ao mesmo tempo" (RN-040).
 */
export function criarAtendimentoService({ repo, relogio, expediente }) {
  /** Carrega a senha, confere o dono e valida a transição de estado. */
  async function carregarParaTransicao(tx, id, usuario, para) {
    const senha = await tx.buscarSenha(id);
    if (!senha) throw naoEncontrado('Senha não encontrada.');
    if (senha.atendente_id !== usuario.id) {
      throw proibido('Esta senha está sendo atendida por outro atendente.', 'senha_de_outro_atendente');
    }
    if (!podeTransitar(senha.estado, para)) {
      throw conflito(
        `Operação inválida: a senha ${senha.numero} está em ${rotuloEstado(senha.estado)}.`,
        'transicao_invalida',
      );
    }
    return senha;
  }

  async function aplicar(tx, senha, para, patch, usuario, agora) {
    await tx.atualizarSenha(senha.id, { estado: para, ...patch });
    await tx.registrarEvento({
      senha_id: senha.id,
      estado_anterior: senha.estado,
      estado_novo: para,
      usuario_id: usuario.id,
      guiche_id: patch.guiche_id ?? senha.guiche_id,
      ocorrido_em: agora,
    });
    return senhaParaDto(await tx.buscarSenha(senha.id));
  }

  return {
    /** Chama a próxima senha conforme a regra de priorização. Retorna null se as filas estão vazias. */
    async chamarProxima(usuario, guicheId) {
      const agora = relogio();
      expediente.garantirAberto(agora);

      const guiche = await repo.buscarGuiche(guicheId);
      if (!guiche || !guiche.ativo) throw naoEncontrado('Guichê não encontrado ou inativo.');

      return repo.comTrava(async (tx) => {
        if (await tx.atendimentoAbertoDoUsuario(usuario.id)) {
          throw conflito(
            'Você já tem uma senha em atendimento. Finalize-a antes de chamar a próxima.',
            'atendimento_em_aberto',
          );
        }
        if (await tx.atendimentoAbertoDoGuiche(guiche.id)) {
          throw conflito(`O guichê ${guiche.numero} já está em atendimento.`, 'guiche_ocupado');
        }

        const hoje = dataLocal(agora);
        const filas = await tx.contagemFila(hoje);
        const ultimoTipo = await tx.lerUltimoTipo();
        const tipo = escolherProximoTipo(ultimoTipo, filas);
        if (!tipo) return null;

        const proxima = await tx.primeiraDaFila(tipo, hoje);
        await tx.salvarUltimoTipo(tipo);
        return aplicar(
          tx,
          proxima,
          ESTADOS.CHAMADA,
          {
            guiche_id: guiche.id,
            atendente_id: usuario.id,
            num_chamadas: 1,
            primeira_chamada_em: agora,
            ultima_chamada_em: agora,
          },
          usuario,
          agora,
        );
      });
    },

    /** "Chamar Novamente": segunda e última chamada (áudio precedido de "Última chamada"). */
    async chamarNovamente(usuario, id) {
      const agora = relogio();
      return repo.comTrava(async (tx) => {
        const senha = await carregarParaTransicao(tx, id, usuario, ESTADOS.CHAMADA_NOVAMENTE);
        return aplicar(
          tx,
          senha,
          ESTADOS.CHAMADA_NOVAMENTE,
          { num_chamadas: 2, segunda_chamada_em: agora, ultima_chamada_em: agora },
          usuario,
          agora,
        );
      });
    },

    /** O cliente chegou ao guichê: inicia o atendimento (SA). */
    async iniciar(usuario, id) {
      const agora = relogio();
      return repo.comTrava(async (tx) => {
        const senha = await carregarParaTransicao(tx, id, usuario, ESTADOS.EM_ATENDIMENTO);
        return aplicar(
          tx,
          senha,
          ESTADOS.EM_ATENDIMENTO,
          { inicio_atendimento_em: agora },
          usuario,
          agora,
        );
      });
    },

    async finalizar(usuario, id) {
      const agora = relogio();
      return repo.comTrava(async (tx) => {
        const senha = await carregarParaTransicao(tx, id, usuario, ESTADOS.ATENDIDA);
        return aplicar(tx, senha, ESTADOS.ATENDIDA, { fim_atendimento_em: agora }, usuario, agora);
      });
    },

    /** Só é possível após as duas chamadas (RN-016): a senha é considerada abandonada. */
    async naoCompareceu(usuario, id) {
      const agora = relogio();
      return repo.comTrava(async (tx) => {
        const senha = await carregarParaTransicao(tx, id, usuario, ESTADOS.NAO_COMPARECEU);
        return aplicar(tx, senha, ESTADOS.NAO_COMPARECEU, {}, usuario, agora);
      });
    },

    /** Atendimento em aberto do usuário (para a tela do atendente retomar após recarregar). */
    async atual(usuario) {
      return senhaParaDto(await repo.atendimentoAbertoDoUsuario(usuario.id));
    },

    async filas() {
      return repo.contagemFila(dataLocal(relogio()));
    },

    /** Fim do expediente (ou virada do dia): descarta as senhas que sobraram (RN-021). */
    async descartarSobras() {
      const agora = relogio();
      return repo.comTrava((tx) =>
        tx.descartarAguardando({
          hoje: dataLocal(agora),
          aposExpediente: expediente.aposFim(agora),
          em: agora,
        }),
      );
    },
  };
}
