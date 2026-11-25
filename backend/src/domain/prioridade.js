// Regra de priorização da fila (docs/requirements/regras-de-negocio.md, RN-010 a RN-014).
//
//   [SP] -> [SE|SG] -> [SP] -> [SE|SG] ...
//
// Função pura: não faz I/O, por isso é totalmente testável.

export const TIPOS = Object.freeze(['SP', 'SE', 'SG']);

export const NOMES_TIPO = Object.freeze({
  SP: 'Prioritária',
  SG: 'Geral',
  SE: 'Retirada de Exames',
});

export function tipoValido(tipo) {
  return TIPOS.includes(tipo);
}

/**
 * Decide o tipo da próxima senha a ser chamada.
 *
 * @param {string|null} ultimoTipo tipo da última senha chamada (null se ainda não houve chamada no dia)
 * @param {{SP?: number|boolean, SE?: number|boolean, SG?: number|boolean}} filas
 *        quantidade (ou presença) de senhas aguardando em cada fila
 * @returns {'SP'|'SE'|'SG'|null} tipo escolhido, ou null se todas as filas estão vazias
 */
export function escolherProximoTipo(ultimoTipo, filas) {
  const temFila = (tipo) => Boolean(filas?.[tipo]);

  // Vaga seguinte a uma SP é "não prioritária": SE vem antes de SG.
  // Nas demais situações a vez é da SP; se não houver SP, SE e SG seguem em ordem.
  const ordem = ultimoTipo === 'SP' ? ['SE', 'SG', 'SP'] : ['SP', 'SE', 'SG'];
  const disponiveis = ordem.filter(temFila);

  if (disponiveis.length === 0) return null;

  // A cada novo atendimento deve ser chamada uma senha de prioridade diferente da
  // anterior, sempre que houver alternativa. Isso também evita que SE (ou SG)
  // monopolize os guichês quando não há SP na fila.
  const diferente = disponiveis.find((tipo) => tipo !== ultimoTipo);
  return diferente ?? disponiveis[0];
}
