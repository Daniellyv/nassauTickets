import { Link } from 'react-router-dom';

const ACESSOS = [
  { para: '/totem', titulo: 'Totem', texto: 'Retirar senha de atendimento (cliente).' },
  { para: '/painel', titulo: 'Painel de chamadas', texto: 'Telão com as últimas senhas chamadas.' },
  { para: '/atendente', titulo: 'Atendente / Gestor', texto: 'Entrar para atender e consultar relatórios.' },
];

export default function Inicio() {
  return (
    <main className="inicio" id="conteudo">
      <img src="/favicon.svg" alt="" width="72" height="72" />
      <h1>nassauTickets</h1>
      <p className="subtitulo">Controle de atendimento do Laboratório de Análises Clínicas</p>
      <ul className="inicio-acessos">
        {ACESSOS.map((acesso) => (
          <li key={acesso.para}>
            <Link to={acesso.para} className="cartao-link">
              <strong>{acesso.titulo}</strong>
              <span>{acesso.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
