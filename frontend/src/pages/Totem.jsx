import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import StatusBanner from '../components/StatusBanner.jsx';
import TicketBadge from '../components/TicketBadge.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { api } from '../services/api.js';
import { mensagemDoErro } from '../services/http.js';
import { formatarHora, numeroCurto, TIPOS_SENHA } from '../utils/formatar.js';

const TEMPO_NA_TELA_MS = 30_000; // tempo suficiente para ler/anotar a senha (WCAG 2.2.1)

export default function Totem() {
  const saude = usePolling(() => api.health(), { intervaloMs: 5000 });
  const [emitindo, setEmitindo] = useState(null);
  const [emitida, setEmitida] = useState(null);
  const [erro, setErro] = useState('');
  const tituloSenha = useRef(null);

  const indisponivel = Boolean(saude.erro?.indisponivel);

  async function emitir(tipo) {
    setEmitindo(tipo);
    setErro('');
    try {
      const { senha } = await api.emitirSenha(tipo);
      setEmitida(senha);
    } catch (e) {
      if (e.codigo === 'fora_do_expediente') setErro(e.message);
      else if (e.indisponivel) setErro('Sistema indisponível. Procure a recepção.');
      else setErro(mensagemDoErro(e));
    } finally {
      setEmitindo(null);
    }
  }

  // Volta à tela inicial sozinho para o próximo cliente
  useEffect(() => {
    if (!emitida) return undefined;
    const timer = setTimeout(() => setEmitida(null), TEMPO_NA_TELA_MS);
    return () => clearTimeout(timer);
  }, [emitida]);

  // Leva o foco ao resultado para leitores de tela
  useEffect(() => {
    if (emitida) tituloSenha.current?.focus();
  }, [emitida]);

  if (emitida) {
    return (
      <main className="totem" id="conteudo">
        <section className="totem-senha" role="status" aria-live="polite">
          <h1 ref={tituloSenha} tabIndex={-1}>
            Sua senha
          </h1>
          <p className="totem-numero" aria-label={`Senha ${emitida.numero}`}>
            {numeroCurto(emitida.numero)}
          </p>
          <p className="totem-detalhe">
            <TicketBadge tipo={emitida.tipo} mostrarNome /> · emitida às {formatarHora(emitida.emitidaEm)}
          </p>
          <p>Número completo: {emitida.numero}</p>
          <p>
            Aguarde ser chamado no painel. Pessoas aguardando antes de você:{' '}
            <strong>{emitida.aguardandoNaFrente}</strong>
          </p>
          <Button onClick={() => setEmitida(null)}>Retirar outra senha</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="totem" id="conteudo">
      <h1>Retire sua senha</h1>
      <p className="subtitulo">Toque no tipo de atendimento desejado</p>

      <StatusBanner erro={saude.erro} rotuloDados="status" />
      {erro && (
        <p className="erro erro-grande" role="alert">
          {erro}
        </p>
      )}

      <div className="totem-opcoes">
        {Object.values(TIPOS_SENHA).map((tipo) => (
          <button
            key={tipo.sigla}
            type="button"
            className={`totem-botao totem-${tipo.sigla}`}
            onClick={() => emitir(tipo.sigla)}
            disabled={indisponivel || emitindo !== null}
            aria-busy={emitindo === tipo.sigla || undefined}
          >
            <span className="totem-sigla" aria-hidden="true">
              {tipo.sigla}
            </span>
            <span className="totem-nome">{tipo.nome}</span>
            <span className="totem-descricao">{tipo.descricao}</span>
          </button>
        ))}
      </div>

      {indisponivel && (
        <p className="aviso-grande">Totem temporariamente indisponível. Procure a recepção.</p>
      )}
      <p className="totem-privacidade">
        Nenhum dado pessoal é solicitado ou armazenado para retirar a senha.
      </p>
      <Link to="/" className="link-discreto">
        Início
      </Link>
    </main>
  );
}
