import bcrypt from 'bcryptjs';
import { conflito, naoEncontrado } from '../utils/erros.js';
import { guicheParaDto, usuarioParaDto } from '../utils/dto.js';
import { CUSTO_BCRYPT } from './authService.js';

/** Cadastros do gestor: atendentes (usuários) e guichês. */
export function criarCadastroService({ repo }) {
  async function validarRegraDoGestorUnico(usuarioAtual, perfilNovo, ativoNovo) {
    const serGestorAtivo = perfilNovo === 'GESTOR' && ativoNovo;
    const outrosGestores = await repo.contarGestoresAtivos(usuarioAtual?.id ?? null);

    if (serGestorAtivo && outrosGestores > 0) {
      throw conflito('Já existe um gestor ativo. O sistema admite um único gestor.', 'gestor_unico');
    }
    const eraGestorAtivo = usuarioAtual?.perfil === 'GESTOR' && usuarioAtual?.ativo;
    if (eraGestorAtivo && !serGestorAtivo && outrosGestores === 0) {
      throw conflito('Deve existir ao menos um gestor ativo.', 'ultimo_gestor');
    }
  }

  return {
    // ---- usuários ----
    async listarUsuarios() {
      return (await repo.listarUsuarios()).map(usuarioParaDto);
    },

    async criarUsuario({ nome, usuario, senha, perfil }) {
      const username = usuario.trim().toLowerCase();
      if (await repo.buscarUsuarioPorUsername(username)) {
        throw conflito('Já existe um usuário com este login.', 'usuario_existente');
      }
      await validarRegraDoGestorUnico(null, perfil, true);
      const id = await repo.criarUsuario({
        nome: nome.trim(),
        username,
        senha_hash: await bcrypt.hash(senha, CUSTO_BCRYPT),
        perfil,
      });
      return usuarioParaDto(await repo.buscarUsuario(id));
    },

    async atualizarUsuario(id, { nome, perfil, ativo, senha }) {
      const atual = await repo.buscarUsuario(id);
      if (!atual) throw naoEncontrado('Usuário não encontrado.');

      const perfilNovo = perfil ?? atual.perfil;
      const ativoNovo = ativo ?? Boolean(atual.ativo);
      await validarRegraDoGestorUnico(atual, perfilNovo, ativoNovo);

      const patch = { perfil: perfilNovo, ativo: ativoNovo ? 1 : 0 };
      if (nome !== undefined) patch.nome = nome.trim();
      if (senha !== undefined) patch.senha_hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
      await repo.atualizarUsuario(id, patch);
      return usuarioParaDto(await repo.buscarUsuario(id));
    },

    // ---- guichês ----
    async listarGuiches() {
      return (await repo.listarGuiches()).map(guicheParaDto);
    },

    async criarGuiche({ numero }) {
      if (await repo.buscarGuichePorNumero(numero)) {
        throw conflito(`O guichê ${numero} já existe.`, 'guiche_existente');
      }
      const id = await repo.criarGuiche({ numero });
      return guicheParaDto(await repo.buscarGuiche(id));
    },

    async atualizarGuiche(id, { ativo }) {
      const atual = await repo.buscarGuiche(id);
      if (!atual) throw naoEncontrado('Guichê não encontrado.');
      if (!ativo) {
        const emUso = await repo.comTrava((tx) => tx.atendimentoAbertoDoGuiche(atual.id));
        if (emUso) {
          throw conflito('O guichê está em atendimento e não pode ser desativado agora.', 'guiche_ocupado');
        }
      }
      await repo.atualizarGuiche(id, { ativo: ativo ? 1 : 0 });
      return guicheParaDto(await repo.buscarGuiche(id));
    },
  };
}
