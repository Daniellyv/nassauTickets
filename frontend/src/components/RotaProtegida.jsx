import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/** Bloqueia a rota para quem não entrou (ou não tem o perfil exigido). */
export default function RotaProtegida({ children, somenteGestor = false }) {
  const { usuario, verificando, ehGestor } = useAuth();
  const local = useLocation();

  if (verificando) return <p className="carregando" role="status">Verificando sessão…</p>;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  if (somenteGestor && !ehGestor) return <Navigate to="/atendente" replace />;
  return children;
}
