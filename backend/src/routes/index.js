import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirAutenticacao, exigirGestor } from '../middlewares/auth.js';
import { schemas, validar } from '../middlewares/validar.js';

const limitador = ({ janelaMs, limite }) =>
  rateLimit({
    windowMs: janelaMs,
    limit: limite,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: 'muitas_requisicoes', mensagem: 'Muitas requisições. Aguarde um pouco.' },
  });

export function criarRotas({ servicos, controllers: c, limites }) {
  const rotas = Router();
  const autenticado = exigirAutenticacao(servicos.auth);

  rotas.get('/health', c.health);

  // Público: totem (AC anônimo) e painel de chamadas
  rotas.post('/senhas', limitador(limites.senhas), validar('body', schemas.emitirSenha), c.emitirSenha);
  rotas.get('/painel', c.painel);

  // Autenticação
  rotas.post('/auth/login', limitador(limites.login), validar('body', schemas.login), c.login);
  rotas.get('/auth/me', autenticado, c.eu);

  // Atendente (o gestor também é atendente)
  const atendimento = Router();
  atendimento.use(autenticado);
  atendimento.get('/atual', c.atendimentoAtual);
  atendimento.get('/filas', c.filas);
  atendimento.post('/chamar-proxima', validar('body', schemas.chamarProxima), c.chamarProxima);
  atendimento.post('/:id/chamar-novamente', validar('params', schemas.idNaRota), c.chamarNovamente);
  atendimento.post('/:id/iniciar', validar('params', schemas.idNaRota), c.iniciar);
  atendimento.post('/:id/finalizar', validar('params', schemas.idNaRota), c.finalizar);
  atendimento.post('/:id/nao-compareceu', validar('params', schemas.idNaRota), c.naoCompareceu);
  rotas.use('/atendimento', atendimento);

  // Guichês: leitura para qualquer usuário autenticado, escrita só do gestor
  rotas.get('/guiches', autenticado, c.listarGuiches);
  rotas.post('/guiches', autenticado, exigirGestor, validar('body', schemas.novoGuiche), c.criarGuiche);
  rotas.put(
    '/guiches/:id',
    autenticado,
    exigirGestor,
    validar('params', schemas.idNaRota),
    validar('body', schemas.atualizarGuiche),
    c.atualizarGuiche,
  );

  // Gestor: usuários e relatórios
  const soGestor = [autenticado, exigirGestor];
  rotas.get('/usuarios', soGestor, c.listarUsuarios);
  rotas.post('/usuarios', soGestor, validar('body', schemas.novoUsuario), c.criarUsuario);
  rotas.put(
    '/usuarios/:id',
    soGestor,
    validar('params', schemas.idNaRota),
    validar('body', schemas.atualizarUsuario),
    c.atualizarUsuario,
  );
  for (const [caminho, handler] of [
    ['/relatorios/diario', c.relatorioResumo],
    ['/relatorios/mensal', c.relatorioResumo],
    ['/relatorios/detalhado', c.relatorioDetalhado],
    ['/relatorios/auditoria', c.relatorioAuditoria],
  ]) {
    rotas.get(caminho, soGestor, validar('query', schemas.periodo), handler);
  }

  return rotas;
}
