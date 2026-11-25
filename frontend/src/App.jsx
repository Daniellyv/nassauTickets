import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Atendente from './pages/Atendente.jsx';
import Guiches from './pages/gestor/Guiches.jsx';
import Relatorios from './pages/gestor/Relatorios.jsx';
import Usuarios from './pages/gestor/Usuarios.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import NaoEncontrada from './pages/NaoEncontrada.jsx';
import Painel from './pages/Painel.jsx';
import Totem from './pages/Totem.jsx';

export default function App() {
  return (
    <Routes>
      {/* Telas públicas: o cliente (AC) interage de forma anônima */}
      <Route path="/" element={<Inicio />} />
      <Route path="/totem" element={<Totem />} />
      <Route path="/painel" element={<Painel />} />
      <Route path="/login" element={<Login />} />

      {/* Telas internas */}
      <Route
        element={
          <RotaProtegida>
            <Layout />
          </RotaProtegida>
        }
      >
        <Route path="/atendente" element={<Atendente />} />
        <Route
          path="/gestor/relatorios"
          element={
            <RotaProtegida somenteGestor>
              <Relatorios />
            </RotaProtegida>
          }
        />
        <Route
          path="/gestor/usuarios"
          element={
            <RotaProtegida somenteGestor>
              <Usuarios />
            </RotaProtegida>
          }
        />
        <Route
          path="/gestor/guiches"
          element={
            <RotaProtegida somenteGestor>
              <Guiches />
            </RotaProtegida>
          }
        />
      </Route>

      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  );
}
