import { formatarHora } from '../utils/formatar.js';

/**
 * Aviso de indisponibilidade (RNF de disponibilidade): aparece quando o backend ou o
 * banco falham, informa até quando os dados exibidos são confiáveis e que o sistema
 * continua tentando reconectar sozinho.
 */
export default function StatusBanner({ erro, atualizadoEm, rotuloDados = 'dados' }) {
  if (!erro) return null;
  const indisponivel = erro.indisponivel ?? true;
  if (!indisponivel) return null;

  return (
    <div className="banner banner-alerta" role="alert">
      <strong>Sistema indisponível — reconectando…</strong>
      {atualizadoEm && (
        <span>
          {' '}
          Exibindo {rotuloDados} de {formatarHora(atualizadoEm)}.
        </span>
      )}
    </div>
  );
}
