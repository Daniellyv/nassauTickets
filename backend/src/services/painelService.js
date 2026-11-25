import { dataLocal } from '../utils/tempo.js';
import { paraIso } from '../utils/tempo.js';

const QUANTIDADE_NO_PAINEL = 5; // RN-050

export function criarPainelService({ repo, relogio, expediente }) {
  return {
    /**
     * Últimas senhas chamadas. Nunca expõe a "próxima" senha (RN-051): entre o
     * fim de um atendimento e a próxima chamada pode entrar uma senha mais prioritária.
     */
    async ultimasChamadas() {
      const agora = relogio();
      const linhas = await repo.ultimasChamadas(QUANTIDADE_NO_PAINEL, dataLocal(agora));
      return {
        geradoEm: agora.toISOString(),
        expedienteAberto: expediente.aberto(agora),
        chamadas: linhas.map((l) => ({
          id: Number(l.id),
          numero: l.numero,
          tipo: l.tipo,
          guiche: l.guiche_numero,
          numChamadas: Number(l.num_chamadas),
          ultimaChamada: Number(l.num_chamadas) >= 2,
          chamadaEm: paraIso(l.ultima_chamada_em),
        })),
      };
    },
  };
}
