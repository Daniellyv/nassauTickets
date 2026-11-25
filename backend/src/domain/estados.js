// Máquina de estados da senha (docs/models/uml/maquina-de-estados.md).
//
// Sequência prevista na especificação:
//   EMITIDA -> AGUARDANDO -> CHAMADA -> CHAMADA_NOVAMENTE -> EM_ATENDIMENTO -> ATENDIDA
// Desvios previstos:
//   - CHAMADA -> EM_ATENDIMENTO     (cliente comparece já na primeira chamada)
//   - CHAMADA_NOVAMENTE -> NAO_COMPARECEU (cliente não comparece após as duas chamadas)
// Extensão documentada:
//   - AGUARDANDO -> DESCARTADA      (fim do expediente: senhas que sobraram são descartadas)

export const ESTADOS = Object.freeze({
  EMITIDA: 'EMITIDA',
  AGUARDANDO: 'AGUARDANDO',
  CHAMADA: 'CHAMADA',
  CHAMADA_NOVAMENTE: 'CHAMADA_NOVAMENTE',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  ATENDIDA: 'ATENDIDA',
  NAO_COMPARECEU: 'NAO_COMPARECEU',
  DESCARTADA: 'DESCARTADA',
});

const TRANSICOES = Object.freeze({
  [ESTADOS.EMITIDA]: [ESTADOS.AGUARDANDO],
  [ESTADOS.AGUARDANDO]: [ESTADOS.CHAMADA, ESTADOS.DESCARTADA],
  [ESTADOS.CHAMADA]: [ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.EM_ATENDIMENTO],
  [ESTADOS.CHAMADA_NOVAMENTE]: [ESTADOS.EM_ATENDIMENTO, ESTADOS.NAO_COMPARECEU],
  [ESTADOS.EM_ATENDIMENTO]: [ESTADOS.ATENDIDA],
  [ESTADOS.ATENDIDA]: [],
  [ESTADOS.NAO_COMPARECEU]: [],
  [ESTADOS.DESCARTADA]: [],
});

/** Estados em que a senha ocupa um guichê/atendente. */
export const ESTADOS_ABERTOS = Object.freeze([
  ESTADOS.CHAMADA,
  ESTADOS.CHAMADA_NOVAMENTE,
  ESTADOS.EM_ATENDIMENTO,
]);

export function podeTransitar(de, para) {
  return (TRANSICOES[de] ?? []).includes(para);
}

export function transicoesDe(estado) {
  return [...(TRANSICOES[estado] ?? [])];
}

/** Rótulo exibido ao usuário (a especificação usa o acento em NÃO_COMPARECEU). */
export function rotuloEstado(estado) {
  return estado === ESTADOS.NAO_COMPARECEU ? 'NÃO_COMPARECEU' : estado;
}
