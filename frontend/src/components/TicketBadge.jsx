import { nomeDoTipo } from '../utils/formatar.js';

/** Selo do tipo de senha. Usa cor + sigla + nome (nunca só a cor). */
export default function TicketBadge({ tipo, mostrarNome = false }) {
  return (
    <span className={`badge badge-${tipo}`} title={nomeDoTipo(tipo)}>
      <span aria-hidden="true">{tipo}</span>
      <span className="sr-only">{nomeDoTipo(tipo)}</span>
      {mostrarNome && <span className="badge-nome">{nomeDoTipo(tipo)}</span>}
    </span>
  );
}
