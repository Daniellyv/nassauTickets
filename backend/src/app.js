import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { criarControllers } from './controllers/index.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erro.js';
import { criarRotas } from './routes/index.js';

const LIMITES_PADRAO = {
  login: { janelaMs: 15 * 60 * 1000, limite: 20 }, // força bruta no login
  senhas: { janelaMs: 60 * 1000, limite: 120 }, // totem
};

/** Cria a aplicação Express a partir dos serviços (facilita testes). */
export function criarApp(servicos, { limites = LIMITES_PADRAO, frontendDist = env.frontendDist } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigem,
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.use('/api', criarRotas({ servicos, controllers: criarControllers(servicos), limites }));

  // Hospedagem: serve o frontend buildado e devolve index.html nas rotas do React Router.
  if (frontendDist && existsSync(path.join(frontendDist, 'index.html'))) {
    const raiz = path.resolve(frontendDist);
    app.use(express.static(raiz, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => res.sendFile(path.join(raiz, 'index.html')));
  }

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
