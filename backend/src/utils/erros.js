/** Erro de negócio com status HTTP e código estável para o frontend. */
export class ErroApp extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.name = 'ErroApp';
    this.status = status;
    this.codigo = codigo;
  }
}

export const requisicaoInvalida = (mensagem, codigo = 'requisicao_invalida') =>
  new ErroApp(400, codigo, mensagem);
export const naoAutenticado = (mensagem = 'Credenciais inválidas ou sessão expirada.') =>
  new ErroApp(401, 'nao_autenticado', mensagem);
export const proibido = (mensagem = 'Você não tem permissão para esta ação.', codigo = 'proibido') =>
  new ErroApp(403, codigo, mensagem);
export const naoEncontrado = (mensagem = 'Recurso não encontrado.') =>
  new ErroApp(404, 'nao_encontrado', mensagem);
export const conflito = (mensagem, codigo = 'conflito') => new ErroApp(409, codigo, mensagem);
