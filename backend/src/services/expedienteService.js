import { env } from '../config/env.js';
import { horaParaMinutos, minutosDoDia } from '../utils/tempo.js';
import { proibido } from '../utils/erros.js';

/** Expediente do laboratório (RN-020): senhas só são emitidas/chamadas das 07:00 às 17:00. */
export function criarExpedienteService(config = env.expediente) {
  const inicio = horaParaMinutos(config.inicio);
  const fim = horaParaMinutos(config.fim);

  const aberto = (agora) => {
    if (!config.aplicar) return true;
    const minutos = minutosDoDia(agora);
    return minutos >= inicio && minutos < fim;
  };

  return {
    inicio: config.inicio,
    fim: config.fim,
    aplicar: config.aplicar,
    aberto,
    /** true quando o expediente já terminou no dia corrente (hora de descartar a fila). */
    aposFim: (agora) => config.aplicar && minutosDoDia(agora) >= fim,
    garantirAberto(agora) {
      if (!aberto(agora)) {
        throw proibido(
          `Fora do expediente de atendimento (${config.inicio} às ${config.fim}).`,
          'fora_do_expediente',
        );
      }
    },
  };
}
