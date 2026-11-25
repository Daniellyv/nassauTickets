import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from './Button.jsx';

/** Estrutura das telas internas (atendente e gestor): cabeçalho, navegação e conteúdo. */
export default function Layout() {
  const { usuario, ehGestor, sair } = useAuth();
  const navegar = useNavigate();

  const aoSair = () => {
    sair();
    navegar('/login');
  };

  return (
    <>
      <a className="pular-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="cabecalho">
        <Link to="/" className="marca" aria-label="nassauTickets, página inicial">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          nassauTickets
        </Link>
        <nav aria-label="Principal" className="menu">
          <NavLink to="/atendente">Atendimento</NavLink>
          {ehGestor && (
            <>
              <NavLink to="/gestor/relatorios">Relatórios</NavLink>
              <NavLink to="/gestor/usuarios">Usuários</NavLink>
              <NavLink to="/gestor/guiches">Guichês</NavLink>
            </>
          )}
        </nav>
        <div className="usuario">
          <span>
            {usuario?.nome} <small>({usuario?.perfil === 'GESTOR' ? 'Gestor' : 'Atendente'})</small>
          </span>
          <Button variante="secundario" onClick={aoSair}>
            Sair
          </Button>
        </div>
      </header>
      <main id="conteudo" className="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
