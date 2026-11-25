import { requisicao } from './http.js';

const consulta = (params) => {
  const busca = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return busca.size ? `?${busca}` : '';
};

export const api = {
  health: () => requisicao('/health', { timeoutMs: 4000 }),

  // Público (totem e painel)
  emitirSenha: (tipo) => requisicao('/senhas', { metodo: 'POST', corpo: { tipo } }),
  painel: () => requisicao('/painel', { timeoutMs: 4000 }),

  // Autenticação
  login: (usuario, senha) => requisicao('/auth/login', { metodo: 'POST', corpo: { usuario, senha } }),
  eu: () => requisicao('/auth/me'),

  // Atendente
  guiches: () => requisicao('/guiches'),
  filas: () => requisicao('/atendimento/filas', { timeoutMs: 4000 }),
  atendimentoAtual: () => requisicao('/atendimento/atual'),
  chamarProxima: (guicheId) =>
    requisicao('/atendimento/chamar-proxima', { metodo: 'POST', corpo: { guicheId } }),
  chamarNovamente: (id) => requisicao(`/atendimento/${id}/chamar-novamente`, { metodo: 'POST' }),
  iniciar: (id) => requisicao(`/atendimento/${id}/iniciar`, { metodo: 'POST' }),
  finalizar: (id) => requisicao(`/atendimento/${id}/finalizar`, { metodo: 'POST' }),
  naoCompareceu: (id) => requisicao(`/atendimento/${id}/nao-compareceu`, { metodo: 'POST' }),

  // Gestor: cadastros
  usuarios: () => requisicao('/usuarios'),
  criarUsuario: (dados) => requisicao('/usuarios', { metodo: 'POST', corpo: dados }),
  atualizarUsuario: (id, dados) => requisicao(`/usuarios/${id}`, { metodo: 'PUT', corpo: dados }),
  criarGuiche: (numero) => requisicao('/guiches', { metodo: 'POST', corpo: { numero } }),
  atualizarGuiche: (id, dados) => requisicao(`/guiches/${id}`, { metodo: 'PUT', corpo: dados }),

  // Gestor: relatórios (periodo = { data } ou { mes })
  relatorioResumo: (periodo) =>
    requisicao(`/relatorios/${periodo.mes ? 'mensal' : 'diario'}${consulta(periodo)}`),
  relatorioDetalhado: (periodo) => requisicao(`/relatorios/detalhado${consulta(periodo)}`),
  relatorioAuditoria: (periodo) => requisicao(`/relatorios/auditoria${consulta(periodo)}`),
  baixarCsv: (tipo, periodo) =>
    requisicao(`/relatorios/${tipo}${consulta({ ...periodo, formato: 'csv' })}`, { formato: 'blob' }),
};
