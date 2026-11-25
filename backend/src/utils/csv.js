/**
 * Gera CSV (separador ';', compatível com Excel pt-BR) com BOM UTF-8.
 * Células que começam com =, +, - ou @ recebem um apóstrofo para evitar injeção de fórmulas.
 */
export function gerarCsv(colunas, linhas) {
  const escapar = (valor) => {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
    return /[";\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
  };
  const cabecalho = colunas.map((c) => escapar(c.titulo)).join(';');
  const corpo = linhas.map((linha) => colunas.map((c) => escapar(linha[c.campo])).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}
