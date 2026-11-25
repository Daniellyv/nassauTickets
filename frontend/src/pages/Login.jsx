import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { mensagemDoErro } from '../services/http.js';

export default function Login() {
  const { usuario, entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [campos, setCampos] = useState({ usuario: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={local.state?.de ?? '/atendente'} replace />;

  const alterar = (evento) => setCampos({ ...campos, [evento.target.name]: evento.target.value });

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(campos.usuario, campos.senha);
      navegar(local.state?.de ?? '/atendente', { replace: true });
    } catch (e) {
      setErro(
        e.status === 401
          ? 'Usuário ou senha incorretos.'
          : e.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
            : e.indisponivel
              ? 'Sistema indisponível no momento. Tente novamente em instantes.'
              : mensagemDoErro(e),
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login" id="conteudo">
      <form className="cartao formulario" onSubmit={enviar} aria-labelledby="titulo-login">
        <h1 id="titulo-login">Entrar</h1>
        <p className="ajuda">Acesso restrito a atendentes e ao gestor.</p>

        <label htmlFor="usuario">Usuário</label>
        <input
          id="usuario"
          name="usuario"
          autoComplete="username"
          value={campos.usuario}
          onChange={alterar}
          required
          autoFocus
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          value={campos.senha}
          onChange={alterar}
          required
        />

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <Button type="submit" carregando={enviando}>
          Entrar
        </Button>
        <Link to="/" className="link-discreto">
          Voltar ao início
        </Link>
      </form>
    </main>
  );
}
