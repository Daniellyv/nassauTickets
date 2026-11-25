import { ESTADOS } from '../domain/estados.js';
import { tipoValido } from '../domain/prioridade.js';
import { conflito, requisicaoInvalida } from '../utils/erros.js';
import { dataLocal } from '../utils/tempo.js';
import { senhaParaDto } from '../utils/dto.js';

const LIMITE_SEQUENCIA_DIARIA = 999; // SQ tem 3 dígitos

/** Monta a numeração YYMMDD-PPSQ (RN-030). Ex.: 260325-SP001. */
export function formatarNumero(dataIso, tipo, sequencia) {
  const [ano, mes, dia] = dataIso.split('-');
  return `${ano.slice(2)}${mes}${dia}-${tipo}${String(sequencia).padStart(3, '0')}`;
}

export function criarSenhaService({ repo, relogio, expediente }) {
  return {
    /** Emite uma senha no totem (agente cliente anônimo). */
    async emitir(tipo) {
      if (!tipoValido(tipo)) throw requisicaoInvalida('Tipo de senha inválido. Use SP, SG ou SE.');

      const agora = relogio();
      expediente.garantirAberto(agora);
      const data = dataLocal(agora);

      return repo.comTrava(async (tx) => {
        const sequencia = await tx.proximoSequencial(data, tipo);
        if (sequencia > LIMITE_SEQUENCIA_DIARIA) {
          throw conflito(
            `Limite diário de senhas ${tipo} atingido (${LIMITE_SEQUENCIA_DIARIA}).`,
            'limite_diario',
          );
        }
        const numero = formatarNumero(data, tipo, sequencia);

        const id = await tx.inserirSenha({
          numero,
          tipo,
          sequencia,
          data_emissao: data,
          estado: ESTADOS.EMITIDA,
          emitida_em: agora,
        });
        await tx.registrarEvento({
          senha_id: id,
          estado_anterior: null,
          estado_novo: ESTADOS.EMITIDA,
          ocorrido_em: agora,
        });

        const fila = await tx.contagemFila(data);
        await tx.atualizarSenha(id, { estado: ESTADOS.AGUARDANDO });
        await tx.registrarEvento({
          senha_id: id,
          estado_anterior: ESTADOS.EMITIDA,
          estado_novo: ESTADOS.AGUARDANDO,
          ocorrido_em: agora,
        });

        const senha = senhaParaDto(await tx.buscarSenha(id));
        const aguardandoNaFrente = fila.SP + fila.SE + fila.SG; // antes de entrar na fila
        return { ...senha, aguardandoNaFrente };
      });
    },
  };
}
