import { Link } from 'react-router-dom';

export default function NaoEncontrada() {
  return (
    <main className="inicio" id="conteudo">
      <h1>Página não encontrada</h1>
      <p>O endereço acessado não existe.</p>
      <Link to="/" className="btn btn-primario">
        Voltar ao início
      </Link>
    </main>
  );
}
