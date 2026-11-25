import bcrypt from 'bcryptjs';
import { criarApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { criarMemoryRepository } from '../src/repositories/memoryRepository.js';
import { criarServicos } from '../src/services/index.js';
import { semearDadosIniciais } from '../src/services/semente.js';

// 25/03/2026 10:00 em America/Recife (UTC-3), dentro do expediente
export const MANHA = '2026-03-25T13:00:00Z';

export const SEMENTE = {
  gestorUsuario: 'gestor',
  gestorSenha: 'Gestor@123',
  atendenteUsuario: 'atendente',
  atendenteSenha: 'Atendente@123',
  guiches: 3,
};

const LIMITES_ALTOS = {
  login: { janelaMs: 1000, limite: 1_000_000 },
  senhas: { janelaMs: 1000, limite: 1_000_000 },
};

/** Monta serviços + app com repositório em memória e relógio controlável. */
export async function criarContexto({ aplicarExpediente = false, agora = MANHA, limites } = {}) {
  const repo = criarMemoryRepository();
  const relogio = { atual: new Date(agora) };
  const config = {
    ...env,
    jwtSecret: 'segredo-de-teste',
    expediente: { inicio: '07:00', fim: '17:00', aplicar: aplicarExpediente },
  };
  const servicos = criarServicos({ repo, relogio: () => new Date(relogio.atual), config });
  await semearDadosIniciais(repo, SEMENTE);
  const app = criarApp(servicos, { limites: limites ?? LIMITES_ALTOS });

  return {
    repo,
    servicos,
    app,
    relogio,
    avancar(ms) {
      relogio.atual = new Date(relogio.atual.getTime() + ms);
    },
    definirAgora(iso) {
      relogio.atual = new Date(iso);
    },
    usuario: (username) => repo.buscarUsuarioPorUsername(username),
    async novoAtendente(username) {
      const id = await repo.criarUsuario({
        nome: `Atendente ${username}`,
        username,
        senha_hash: await bcrypt.hash('Atendente@123', 4),
        perfil: 'ATENDENTE',
      });
      return repo.buscarUsuario(id);
    },
    guiche: async (numero) => repo.buscarGuichePorNumero(numero),
    async emitir(...tipos) {
      const emitidas = [];
      for (const tipo of tipos) emitidas.push(await servicos.senhas.emitir(tipo));
      return emitidas;
    },
    /** Chama a próxima, inicia e finaliza; devolve o número atendido (ou null). */
    async atenderProxima(usuario, guicheId) {
      const chamada = await servicos.atendimento.chamarProxima(usuario, guicheId);
      if (!chamada) return null;
      await servicos.atendimento.iniciar(usuario, chamada.id);
      await servicos.atendimento.finalizar(usuario, chamada.id);
      return chamada.numero;
    },
  };
}

export async function entrar(app, request, usuario, senha) {
  const resposta = await request(app).post('/api/auth/login').send({ usuario, senha });
  return resposta.body.token;
}
