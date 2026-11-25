// Cria o gestor, um atendente e os guichês iniciais no banco (idempotente).
//   cd backend && npm run seed
import { env } from '../src/config/env.js';
import { criarRepositorio } from '../src/repositories/index.js';
import { semearDadosIniciais } from '../src/services/semente.js';

const repo = criarRepositorio();
try {
  const criados = await semearDadosIniciais(repo);
  console.log(`Seed concluído: ${criados.usuarios} usuário(s) e ${criados.guiches} guichê(s) criados.`);
  console.log(`Gestor: "${env.seed.gestorUsuario}"  |  Atendente: "${env.seed.atendenteUsuario}"`);
  console.log('As senhas iniciais estão em .env (SEED_*). Troque-as fora do ambiente de desenvolvimento.');
} catch (erro) {
  console.error('Falha no seed:', erro.code ?? erro.message);
  process.exitCode = 1;
} finally {
  await repo.fechar();
}
