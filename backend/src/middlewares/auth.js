import { naoAutenticado, proibido } from '../utils/erros.js';

/** Exige "Authorization: Bearer <token>" válido e carrega req.usuario. */
export function exigirAutenticacao(authService) {
  return async (req, _res, next) => {
    const cabecalho = req.get('authorization') ?? '';
    const [esquema, token] = cabecalho.split(' ');
    if (esquema !== 'Bearer' || !token) throw naoAutenticado('Autenticação necessária.');
    req.usuario = await authService.autenticarToken(token);
    next();
  };
}

/** Restringe a rota ao perfil GESTOR (cadastros e relatórios). */
export function exigirGestor(req, _res, next) {
  if (req.usuario?.perfil !== 'GESTOR') {
    throw proibido('Apenas o gestor pode acessar este recurso.', 'somente_gestor');
  }
  next();
}
