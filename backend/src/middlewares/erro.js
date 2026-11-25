import { ErroApp } from '../utils/erros.js';

// Códigos de falha de conexão/disponibilidade do MySQL e da rede.
const CODIGOS_INDISPONIVEL = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST',
  'POOL_CLOSED',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR',
]);

export function rotaNaoEncontrada(req, _res, next) {
  next(new ErroApp(404, 'rota_nao_encontrada', `Rota não encontrada: ${req.method} ${req.path}`));
}

/** Converte qualquer erro em JSON { erro, mensagem } sem vazar detalhes internos. */
// eslint-disable-next-line no-unused-vars
export function tratarErros(erro, _req, res, _next) {
  if (erro instanceof ErroApp) {
    return res.status(erro.status).json({
      erro: erro.codigo,
      mensagem: erro.message,
      ...(erro.detalhes ? { detalhes: erro.detalhes } : {}),
    });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'json_invalido', mensagem: 'Corpo da requisição inválido.' });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'corpo_grande', mensagem: 'Corpo da requisição grande demais.' });
  }
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'registro_duplicado', mensagem: 'Registro já existe.' });
  }
  if (CODIGOS_INDISPONIVEL.has(erro.code) || erro.fatal) {
    console.error('[banco indisponível]', erro.code ?? erro.message);
    return res.status(503).json({
      erro: 'servico_indisponivel',
      mensagem: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
    });
  }
  console.error('[erro interno]', erro);
  return res.status(500).json({ erro: 'erro_interno', mensagem: 'Erro interno do servidor.' });
}
