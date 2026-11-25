import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { naoAutenticado } from '../utils/erros.js';
import { usuarioParaDto } from '../utils/dto.js';

export const CUSTO_BCRYPT = 10;

export function criarAuthService({ repo, config = env }) {
  // Hash fictício: mantém o tempo de resposta parecido quando o usuário não existe.
  const hashFalso = bcrypt.hashSync('senha-inexistente', CUSTO_BCRYPT);

  return {
    async login(username, senha) {
      const usuario = await repo.buscarUsuarioPorUsername(username.trim().toLowerCase());
      const confere = await bcrypt.compare(senha, usuario?.senha_hash ?? hashFalso);
      if (!usuario || !usuario.ativo || !confere) throw naoAutenticado();

      const token = jwt.sign({ nome: usuario.nome, perfil: usuario.perfil }, config.jwtSecret, {
        subject: String(usuario.id),
        expiresIn: config.jwtExpiracao,
      });
      return { token, usuario: usuarioParaDto(usuario) };
    },

    /** Valida o token e recarrega o usuário (desativação vale na hora). */
    async autenticarToken(token) {
      let payload;
      try {
        payload = jwt.verify(token, config.jwtSecret);
      } catch {
        throw naoAutenticado();
      }
      const usuario = await repo.buscarUsuario(Number(payload.sub));
      if (!usuario || !usuario.ativo) throw naoAutenticado();
      return usuarioParaDto(usuario);
    },
  };
}
