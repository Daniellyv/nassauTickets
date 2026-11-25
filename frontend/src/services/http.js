// Cliente HTTP único da aplicação: token, tempo limite e erros padronizados.

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ErroApi extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  /** Falha de rede, tempo esgotado ou erro do servidor/banco (vale tentar de novo). */
  get indisponivel() {
    return this.status === 0 || this.status >= 500;
  }
}

let token = null;
let aoSessaoExpirar = null;

export const definirToken = (novo) => {
  token = novo;
};
export const aoExpirarSessao = (funcao) => {
  aoSessaoExpirar = funcao;
};

export async function requisicao(caminho, { metodo = 'GET', corpo, formato = 'json', timeoutMs = 8000 } = {}) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);

  let resposta;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErroApi(0, 'sem_conexao', 'Sem conexão com o servidor.');
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 401 && token) aoSessaoExpirar?.();
    throw new ErroApi(
      resposta.status,
      dados.erro ?? 'erro',
      dados.mensagem ?? 'Não foi possível concluir a operação.',
      dados.detalhes,
    );
  }
  return formato === 'blob' ? resposta.blob() : resposta.json();
}

/** Mensagem amigável para exibir ao usuário, incluindo detalhes de validação. */
export function mensagemDoErro(erro) {
  if (!(erro instanceof ErroApi)) return 'Ocorreu um erro inesperado.';
  const detalhes = erro.detalhes?.map((d) => d.mensagem).join(' ');
  return detalhes ? `${erro.message} ${detalhes}` : erro.message;
}
