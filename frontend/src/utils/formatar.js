// Tipos de senha e funções de formatação usadas em várias telas.

export const TIPOS_SENHA = {
  SP: {
    sigla: 'SP',
    nome: 'Prioritária',
    fala: 'prioritária',
    descricao: 'Idosos, gestantes, pessoas com deficiência e demais casos previstos em lei',
  },
  SG: { sigla: 'SG', nome: 'Geral', fala: 'geral', descricao: 'Atendimento geral' },
  SE: {
    sigla: 'SE',
    nome: 'Retirada de Exames',
    fala: 'exames',
    descricao: 'Somente para retirar resultados de exames',
  },
};

export const nomeDoTipo = (tipo) => TIPOS_SENHA[tipo]?.nome ?? tipo;

/** Parte sequencial (SQ) de um número YYMMDD-PPSQ: '260325-SG007' -> 7 */
export const sequencialDe = (numero) => Number(String(numero).slice(-3));

/** Parte "PPSQ" de um número YYMMDD-PPSQ: '260325-SG007' -> 'SG007' (cabe melhor no painel). */
export const numeroCurto = (numero) => String(numero).split('-')[1] ?? String(numero);

/** Texto lido em voz alta na chamada (RN-052/RN-053). */
export function textoDaChamada({ tipo, numero, guiche, ultimaChamada }) {
  const fala = TIPOS_SENHA[tipo]?.fala ?? tipo;
  const prefixo = ultimaChamada ? 'Última chamada. ' : '';
  return `${prefixo}Senha ${fala} ${sequencialDe(numero)}. Guichê ${guiche}.`;
}

/** Segundos -> '5min 03s' (ou '—' quando não há dado). */
export function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const total = Math.round(segundos);
  const minutos = Math.floor(total / 60);
  const resto = String(total % 60).padStart(2, '0');
  return `${minutos}min ${resto}s`;
}

const FUSO = 'America/Recife';

export function formatarHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  });
}

export function formatarDataHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: FUSO,
  });
}

/** 'YYYY-MM-DD' de hoje no fuso do laboratório. */
export function hojeIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
}

export const ROTULOS_ESTADO = {
  EMITIDA: 'Emitida',
  AGUARDANDO: 'Aguardando',
  CHAMADA: 'Chamada',
  CHAMADA_NOVAMENTE: 'Chamada novamente',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
  NAO_COMPARECEU: 'Não compareceu',
  DESCARTADA: 'Descartada',
};
