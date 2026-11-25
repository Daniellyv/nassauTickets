import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { aoExpirarSessao, definirToken } from '../services/http.js';

const AuthContext = createContext(null);
const CHAVE = 'nt.sessao';

function lerSessao() {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function gravarSessao(token) {
  try {
    if (token) sessionStorage.setItem(CHAVE, token);
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // sem sessionStorage: a sessão vale só até recarregar a página
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(() => Boolean(lerSessao()));

  const sair = useCallback(() => {
    definirToken(null);
    gravarSessao(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    aoExpirarSessao(sair);
  }, [sair]);

  // Ao abrir a página, revalida o token guardado na sessão do navegador
  useEffect(() => {
    const token = lerSessao();
    if (!token) return undefined;
    let ativo = true;
    definirToken(token);
    api
      .eu()
      .then(({ usuario: dados }) => ativo && setUsuario(dados))
      .catch(() => ativo && sair())
      .finally(() => ativo && setVerificando(false));
    return () => {
      ativo = false;
    };
  }, [sair]);

  const entrar = useCallback(async (nomeUsuario, senha) => {
    const resposta = await api.login(nomeUsuario, senha);
    definirToken(resposta.token);
    gravarSessao(resposta.token);
    setUsuario(resposta.usuario);
    return resposta.usuario;
  }, []);

  const valor = useMemo(
    () => ({ usuario, verificando, entrar, sair, ehGestor: usuario?.perfil === 'GESTOR' }),
    [usuario, verificando, entrar, sair],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return contexto;
}
