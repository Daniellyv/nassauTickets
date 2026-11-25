import { criarApp } from './app.js';
import { env } from './config/env.js';
import { iniciarJobExpediente } from './jobs/expediente.js';
import { criarRepositorio } from './repositories/index.js';
import { criarServicos } from './services/index.js';
import { semearDadosIniciais } from './services/semente.js';

const repo = criarRepositorio();
const servicos = criarServicos({ repo });

// Sem banco (memory) não há "npm run seed" separado: cria usuários/guichês de demonstração.
if (repo.nome === 'memory') {
  await semearDadosIniciais(repo);
  console.warn('[aviso] DB_DRIVER=memory: dados de demonstração, perdidos ao reiniciar.');
}

const app = criarApp(servicos);
const servidor = app.listen(env.porta, () => {
  console.log(`nassauTickets API em http://localhost:${env.porta}/api (banco: ${repo.nome})`);
});

const pararJob = iniciarJobExpediente({ atendimento: servicos.atendimento });

async function encerrar(sinal) {
  console.log(`\n${sinal} recebido, encerrando...`);
  pararJob();
  servidor.close(async () => {
    await repo.fechar();
    process.exit(0);
  });
}
process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));
