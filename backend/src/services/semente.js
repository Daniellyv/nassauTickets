import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { CUSTO_BCRYPT } from './authService.js';

/**
 * Cria (se ainda não existirem) o gestor, um atendente e os guichês iniciais.
 * Idempotente: pode ser executada várias vezes.
 */
export async function semearDadosIniciais(repo, config = env.seed) {
  const criados = { usuarios: 0, guiches: 0 };

  const garantirUsuario = async (nome, username, senha, perfil) => {
    if (await repo.buscarUsuarioPorUsername(username)) return;
    await repo.criarUsuario({
      nome,
      username,
      senha_hash: await bcrypt.hash(senha, CUSTO_BCRYPT),
      perfil,
    });
    criados.usuarios += 1;
  };

  await garantirUsuario('Gestor do Laboratório', config.gestorUsuario, config.gestorSenha, 'GESTOR');
  await garantirUsuario(
    'Atendente do Laboratório',
    config.atendenteUsuario,
    config.atendenteSenha,
    'ATENDENTE',
  );

  for (let numero = 1; numero <= config.guiches; numero += 1) {
    if (!(await repo.buscarGuichePorNumero(numero))) {
      await repo.criarGuiche({ numero });
      criados.guiches += 1;
    }
  }
  return criados;
}
