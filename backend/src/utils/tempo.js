import { env } from '../config/env.js';

const formatadores = new Map();

function formatador(fuso) {
  if (!formatadores.has(fuso)) {
    formatadores.set(
      fuso,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: fuso,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }),
    );
  }
  return formatadores.get(fuso);
}

/** Partes da data/hora no fuso do laboratório (padrão America/Recife). */
export function partesLocais(data, fuso = env.fusoHorario) {
  const partes = {};
  for (const { type, value } of formatador(fuso).formatToParts(data)) {
    partes[type] = value;
  }
  return {
    ano: partes.year,
    mes: partes.month,
    dia: partes.day,
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

/** 'YYYY-MM-DD' no fuso local. */
export function dataLocal(data, fuso = env.fusoHorario) {
  const p = partesLocais(data, fuso);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** Minutos desde 00:00 no fuso local. */
export function minutosDoDia(data, fuso = env.fusoHorario) {
  const p = partesLocais(data, fuso);
  return p.hora * 60 + p.minuto;
}

export function horaParaMinutos(texto) {
  const [h, m] = texto.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 'DD/MM/YYYY HH:mm:ss' no fuso local; vazio se não houver data. */
export function formatarLocal(valor, fuso = env.fusoHorario) {
  if (!valor) return '';
  const p = partesLocais(new Date(valor), fuso);
  const dois = (n) => String(n).padStart(2, '0');
  return `${p.dia}/${p.mes}/${p.ano} ${dois(p.hora)}:${dois(p.minuto)}:${dois(p.segundo)}`;
}

export function paraIso(valor) {
  return valor ? new Date(valor).toISOString() : null;
}

/** Primeiro dia do mês seguinte a 'YYYY-MM' (limite exclusivo de um período mensal). */
export function inicioDoMesSeguinte(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const proximo = m === 12 ? [ano + 1, 1] : [ano, m + 1];
  return `${proximo[0]}-${String(proximo[1]).padStart(2, '0')}-01`;
}
