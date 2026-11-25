import { ESTADOS } from '../domain/estados.js';
import { TIPOS } from '../domain/prioridade.js';
import { requisicaoInvalida } from '../utils/erros.js';
import { gerarCsv } from '../utils/csv.js';
import {
  dataLocal,
  formatarLocal,
  inicioDoMesSeguinte,
  paraIso,
  partesLocais,
} from '../utils/tempo.js';

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const segundos = (de, ate) => (de && ate ? (new Date(ate) - new Date(de)) / 1000 : null);

function media(valores) {
  const validos = valores.filter((v) => v !== null && Number.isFinite(v) && v >= 0);
  if (validos.length === 0) return null;
  return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
}

const porcentagem = (parte, total) => (total === 0 ? 0 : Math.round((parte / total) * 1000) / 10);

/** true só para datas reais (rejeita 2026-02-30, que Date.parse aceitaria). */
function dataExiste(dataIso) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

function diaSeguinte(dataIso) {
  const [a, m, d] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Resolve ?data=YYYY-MM-DD (diário) ou ?mes=YYYY-MM (mensal) em um intervalo de datas. */
export function resolverPeriodo({ data, mes }, agora = new Date()) {
  if (data && mes) throw requisicaoInvalida('Informe "data" ou "mes", não os dois.');
  if (mes) {
    if (!REGEX_MES.test(mes)) throw requisicaoInvalida('Mês inválido. Use o formato AAAA-MM.');
    return { tipo: 'mensal', referencia: mes, inicio: `${mes}-01`, fimExclusivo: inicioDoMesSeguinte(mes) };
  }
  const dia = data ?? dataLocal(agora);
  if (!REGEX_DATA.test(dia) || !dataExiste(dia)) {
    throw requisicaoInvalida('Data inválida. Use o formato AAAA-MM-DD.');
  }
  return { tipo: 'diario', referencia: dia, inicio: dia, fimExclusivo: diaSeguinte(dia) };
}

/** Quantitativos, TM e indicadores de desempenho a partir das senhas do período. */
export function montarResumo(linhas) {
  const porTipo = Object.fromEntries(
    TIPOS.map((tipo) => [tipo, { emitidas: 0, atendidas: 0, naoCompareceu: 0, descartadas: 0 }]),
  );
  const duracoes = Object.fromEntries(TIPOS.map((tipo) => [tipo, []]));
  const esperas = [];
  const porAtendente = new Map();
  const porHora = new Map();
  const porDia = new Map();

  for (const l of linhas) {
    const t = porTipo[l.tipo];
    t.emitidas += 1;

    const dia = porDia.get(l.data_emissao) ?? { data: l.data_emissao, emitidas: 0, atendidas: 0 };
    dia.emitidas += 1;
    porDia.set(l.data_emissao, dia);

    if (l.primeira_chamada_em) esperas.push(segundos(l.emitida_em, l.primeira_chamada_em));

    if (l.estado === ESTADOS.ATENDIDA) {
      t.atendidas += 1;
      dia.atendidas += 1;
      const duracao = segundos(l.inicio_atendimento_em, l.fim_atendimento_em);
      duracoes[l.tipo].push(duracao);

      const nome = l.atendente_nome ?? '—';
      const ate = porAtendente.get(nome) ?? { atendente: nome, atendidas: 0, duracoes: [] };
      ate.atendidas += 1;
      ate.duracoes.push(duracao);
      porAtendente.set(nome, ate);

      if (l.inicio_atendimento_em) {
        const hora = partesLocais(new Date(l.inicio_atendimento_em)).hora;
        porHora.set(hora, (porHora.get(hora) ?? 0) + 1);
      }
    } else if (l.estado === ESTADOS.NAO_COMPARECEU) {
      t.naoCompareceu += 1;
    } else if (l.estado === ESTADOS.DESCARTADA) {
      t.descartadas += 1;
    }
  }

  const soma = (campo) => TIPOS.reduce((total, tipo) => total + porTipo[tipo][campo], 0);
  const emitidas = soma('emitidas');
  const atendidas = soma('atendidas');
  const naoCompareceu = soma('naoCompareceu');
  const descartadas = soma('descartadas');

  return {
    totais: { emitidas, atendidas, naoCompareceu, descartadas },
    porTipo,
    // Tempo Médio de atendimento (TM), em segundos
    tm: {
      geral: media(TIPOS.flatMap((tipo) => duracoes[tipo])),
      porTipo: Object.fromEntries(TIPOS.map((tipo) => [tipo, media(duracoes[tipo])])),
    },
    desempenho: {
      taxaAtendimento: porcentagem(atendidas, emitidas),
      taxaNaoComparecimento: porcentagem(naoCompareceu, emitidas),
      esperaMediaSegundos: media(esperas),
      porAtendente: [...porAtendente.values()]
        .map(({ atendente, atendidas: n, duracoes: d }) => ({
          atendente,
          atendidas: n,
          tmSegundos: media(d),
        }))
        .sort((a, b) => b.atendidas - a.atendidas),
      porHora: [...porHora.entries()]
        .map(([hora, n]) => ({ hora, atendidas: n }))
        .sort((a, b) => a.hora - b.hora),
      porDia: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)),
    },
  };
}

export function montarDetalhado(linhas) {
  return linhas.map((l) => {
    const atendida = l.estado === ESTADOS.ATENDIDA;
    return {
      numero: l.numero,
      tipo: l.tipo,
      estado: l.estado,
      emitidaEm: paraIso(l.emitida_em),
      // Senhas não atendidas ficam com os campos de atendimento em branco (RN-061)
      atendidaEm: atendida ? paraIso(l.inicio_atendimento_em) : null,
      guiche: atendida ? l.guiche_numero : null,
    };
  });
}

export function montarAuditoria(linhas) {
  return linhas
    .filter((l) => l.primeira_chamada_em)
    .sort((a, b) => new Date(a.primeira_chamada_em) - new Date(b.primeira_chamada_em))
    .map((l) => ({
      atendente: l.atendente_nome,
      guiche: l.guiche_numero,
      senha: l.numero,
      estadoFinal: l.estado,
      primeiraChamadaEm: paraIso(l.primeira_chamada_em),
      segundaChamadaEm: paraIso(l.segunda_chamada_em),
      inicioAtendimentoEm: paraIso(l.inicio_atendimento_em),
      fimAtendimentoEm: paraIso(l.fim_atendimento_em),
    }));
}

const COLUNAS_DETALHADO = [
  { titulo: 'Senha', campo: 'numero' },
  { titulo: 'Tipo', campo: 'tipo' },
  { titulo: 'Situação', campo: 'estado' },
  { titulo: 'Emissão', campo: 'emitidaEmFmt' },
  { titulo: 'Atendimento', campo: 'atendidaEmFmt' },
  { titulo: 'Guichê', campo: 'guiche' },
];

const COLUNAS_AUDITORIA = [
  { titulo: 'Atendente', campo: 'atendente' },
  { titulo: 'Guichê', campo: 'guiche' },
  { titulo: 'Senha', campo: 'senha' },
  { titulo: 'Situação final', campo: 'estadoFinal' },
  { titulo: '1ª chamada', campo: 'primeiraFmt' },
  { titulo: '2ª chamada', campo: 'segundaFmt' },
  { titulo: 'Início do atendimento', campo: 'inicioFmt' },
  { titulo: 'Fim do atendimento', campo: 'fimFmt' },
];

export function criarRelatorioService({ repo, relogio }) {
  const carregar = async (consulta) => {
    const periodo = resolverPeriodo(consulta, relogio());
    const linhas = await repo.senhasPorPeriodo(periodo.inicio, periodo.fimExclusivo);
    return { periodo, linhas };
  };

  return {
    async resumo(consulta) {
      const { periodo, linhas } = await carregar(consulta);
      return { periodo, geradoEm: relogio().toISOString(), ...montarResumo(linhas) };
    },

    async detalhado(consulta, formato) {
      const { periodo, linhas } = await carregar(consulta);
      const itens = montarDetalhado(linhas);
      if (formato === 'csv') {
        return gerarCsv(
          COLUNAS_DETALHADO,
          itens.map((i) => ({
            ...i,
            emitidaEmFmt: formatarLocal(i.emitidaEm),
            atendidaEmFmt: formatarLocal(i.atendidaEm),
          })),
        );
      }
      return { periodo, itens };
    },

    async auditoria(consulta, formato) {
      const { periodo, linhas } = await carregar(consulta);
      const itens = montarAuditoria(linhas);
      if (formato === 'csv') {
        return gerarCsv(
          COLUNAS_AUDITORIA,
          itens.map((i) => ({
            ...i,
            primeiraFmt: formatarLocal(i.primeiraChamadaEm),
            segundaFmt: formatarLocal(i.segundaChamadaEm),
            inicioFmt: formatarLocal(i.inicioAtendimentoEm),
            fimFmt: formatarLocal(i.fimAtendimentoEm),
          })),
        );
      }
      return { periodo, itens };
    },
  };
}
