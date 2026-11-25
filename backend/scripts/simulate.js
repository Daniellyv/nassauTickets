// Simulador de um dia (ou mais) de atendimento, usando os serviços reais do sistema
// com um relógio virtual. Aplica as estatísticas históricas do enunciado:
//   - TM da SG: 5 min ± 3 (distribuição uniforme)
//   - TM da SP: 15 min ± 5 (distribuição uniforme)
//   - TM da SE: 1 min em 95% dos atendimentos e 5 min em 5%
//   - 5% das senhas emitidas não comparecem (duas chamadas sem resposta)
//
// Uso:
//   npm run simulate                                  # 1 dia, 3 guichês, em memória
//   npm run simulate -- --dias=5 --guiches=4 --seed=7
//   npm run simulate -- --driver=mysql --dias=10      # grava no banco para ver os relatórios na tela
//
// Opções: --dias, --guiches, --chegadas (senhas/minuto, padrão 0.3), --seed,
//         --inicio=AAAA-MM-DD, --driver=memory|mysql
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { criarMemoryRepository } from '../src/repositories/memoryRepository.js';
import { criarRepositorio } from '../src/repositories/index.js';
import { criarServicos } from '../src/services/index.js';
import { semearDadosIniciais } from '../src/services/semente.js';
import { dataLocal, partesLocais } from '../src/utils/tempo.js';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [chave, valor = 'true'] = a.slice(2).split('=');
      return [chave, valor];
    }),
);

const DIAS = Number(args.dias ?? 1);
const NUM_GUICHES = Number(args.guiches ?? 3);
const CHEGADAS_POR_MINUTO = Number(args.chegadas ?? 0.3);
const SEMENTE = Number(args.seed ?? Date.now() % 100000);
const DRIVER = args.driver ?? 'memory';
const PASSO_MS = 10_000;
const PROB_NAO_COMPARECE = 0.05;
const MIX = [
  ['SG', 0.55],
  ['SE', 0.25],
  ['SP', 0.2],
];

// Gerador pseudoaleatório reproduzível (mulberry32)
function criarAleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const aleatorio = criarAleatorio(SEMENTE);
const entre = (min, max) => min + aleatorio() * (max - min);
const minutos = (n) => n * 60_000;

function duracaoDoAtendimento(tipo) {
  if (tipo === 'SG') return minutos(entre(2, 8));
  if (tipo === 'SP') return minutos(entre(10, 20));
  return minutos(aleatorio() < 0.95 ? 1 : 5);
}

function sortearTipo() {
  const r = aleatorio();
  let acumulado = 0;
  for (const [tipo, peso] of MIX) {
    acumulado += peso;
    if (r < acumulado) return tipo;
  }
  return 'SG';
}

/** Instante UTC em que o relógio local do laboratório marca hh:00 na data informada. */
function instanteLocal(dataIso, hora) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const chute = Date.UTC(a, m - 1, d, hora);
  return new Date(chute - (partesLocais(new Date(chute)).hora - hora) * 3_600_000);
}

function somarDias(dataIso, n) {
  const [a, m, d] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

const repo = DRIVER === 'mysql' ? criarRepositorio('mysql') : criarMemoryRepository();
const relogio = { atual: new Date() };
const servicos = criarServicos({
  repo,
  relogio: () => new Date(relogio.atual),
  config: { ...env, expediente: { ...env.expediente, aplicar: true } },
});

await semearDadosIniciais(repo);

// Atendentes e guichês da simulação
const atendentes = [];
for (let i = 1; i <= NUM_GUICHES; i += 1) {
  const username = `sim${i}`;
  let usuario = await repo.buscarUsuarioPorUsername(username);
  if (!usuario) {
    const id = await repo.criarUsuario({
      nome: `Atendente Simulado ${i}`,
      username,
      senha_hash: await bcrypt.hash(`sim-${Math.random()}`, 4),
      perfil: 'ATENDENTE',
    });
    usuario = await repo.buscarUsuario(id);
  }
  let guiche = await repo.buscarGuichePorNumero(i);
  if (!guiche) {
    await repo.criarGuiche({ numero: i });
    guiche = await repo.buscarGuichePorNumero(i);
  }
  atendentes.push({ usuario, guiche, fase: 'livre', ate: 0, senha: null, faltou: false });
}

async function simularDia(dataIso) {
  const inicio = instanteLocal(dataIso, 7).getTime();
  const fim = instanteLocal(dataIso, 17).getTime();
  const { atendimento, senhas } = servicos;
  for (const a of atendentes) Object.assign(a, { fase: 'livre', ate: 0, senha: null, faltou: false });

  const ocupados = () => atendentes.some((a) => a.fase !== 'livre');

  for (let t = inicio; t < fim || ocupados(); t += PASSO_MS) {
    relogio.atual = new Date(t);
    const expedienteAberto = t < fim;

    // Chegadas (processo de Bernoulli a cada passo)
    if (expedienteAberto && aleatorio() < CHEGADAS_POR_MINUTO / (60_000 / PASSO_MS)) {
      await senhas.emitir(sortearTipo());
    }

    for (const a of atendentes) {
      if (a.fase === 'livre') {
        if (!expedienteAberto) continue;
        const chamada = await atendimento.chamarProxima(a.usuario, a.guiche.id);
        if (!chamada) continue;
        a.senha = chamada;
        a.faltou = aleatorio() < PROB_NAO_COMPARECE;
        a.fase = a.faltou ? 'espera1' : 'caminhando';
        a.ate = t + (a.faltou ? minutos(1) : entre(10_000, 40_000));
      } else if (t >= a.ate) {
        if (a.fase === 'espera1') {
          await atendimento.chamarNovamente(a.usuario, a.senha.id);
          a.fase = 'espera2';
          a.ate = t + minutos(1);
        } else if (a.fase === 'espera2') {
          await atendimento.naoCompareceu(a.usuario, a.senha.id);
          a.fase = 'livre';
        } else if (a.fase === 'caminhando') {
          await atendimento.iniciar(a.usuario, a.senha.id);
          a.fase = 'atendendo';
          a.ate = t + duracaoDoAtendimento(a.senha.tipo);
        } else if (a.fase === 'atendendo') {
          await atendimento.finalizar(a.usuario, a.senha.id);
          a.fase = 'livre';
        }
      }
    }
  }

  // Fim do expediente: o que sobrou na fila é descartado
  relogio.atual = new Date(Math.max(relogio.atual.getTime(), fim) + 1000);
  return atendimento.descartarSobras();
}

const inicioSimulacao = args.inicio ?? somarDias(dataLocal(new Date()), -(DIAS - 1));
console.log(
  `Simulando ${DIAS} dia(s) a partir de ${inicioSimulacao} | ${NUM_GUICHES} guichê(s) | ` +
    `${CHEGADAS_POR_MINUTO} senhas/min | semente ${SEMENTE} | banco: ${repo.nome}`,
);

let descartadasTotal = 0;
for (let i = 0; i < DIAS; i += 1) {
  descartadasTotal += await simularDia(somarDias(inicioSimulacao, i));
}

const mm = (s) => (s === null ? '—' : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`);
const ultimoDia = somarDias(inicioSimulacao, DIAS - 1);
const consulta = DIAS === 1 ? { data: ultimoDia } : { mes: ultimoDia.slice(0, 7) };
const r = await servicos.relatorios.resumo(consulta);

console.log(`\nRelatório ${r.periodo.tipo} (${r.periodo.referencia})`);
console.table({
  SP: r.porTipo.SP,
  SE: r.porTipo.SE,
  SG: r.porTipo.SG,
  Total: r.totais,
});
console.log('TM (tempo médio de atendimento):');
console.log(`  SP ${mm(r.tm.porTipo.SP)} | SE ${mm(r.tm.porTipo.SE)} | SG ${mm(r.tm.porTipo.SG)} | geral ${mm(r.tm.geral)}`);
console.log(`Espera média até a 1ª chamada: ${mm(r.desempenho.esperaMediaSegundos)}`);
console.log(
  `Taxa de atendimento: ${r.desempenho.taxaAtendimento}% | não comparecimento: ${r.desempenho.taxaNaoComparecimento}% | descartadas no fim do expediente: ${descartadasTotal}`,
);
console.log('Atendimentos por atendente:');
console.table(r.desempenho.porAtendente.map((x) => ({ ...x, tm: mm(x.tmSegundos) })));

await repo.fechar();
