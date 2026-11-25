import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import StatusBanner from '../components/StatusBanner.jsx';
import TicketBadge from '../components/TicketBadge.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { useVozChamada } from '../hooks/useVozChamada.js';
import { api } from '../services/api.js';
import { formatarHora, numeroCurto, textoDaChamada } from '../utils/formatar.js';

function useRelogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return agora;
}

export default function Painel() {
  // Se o backend cair, o painel continua exibindo a última lista conhecida (cache local)
  const { dados, erro, atualizadoEm } = usePolling(() => api.painel(), {
    intervaloMs: 2000,
    chaveCache: 'nt.painel',
  });
  const agora = useRelogio();
  const { suportado, falar } = useVozChamada();
  const [audioAtivo, setAudioAtivo] = useState(false);
  const vistas = useRef(null); // id da senha -> instante da última chamada já tratada

  // Detecta chamadas novas (inclusive "Chamar Novamente") e lê em voz alta
  useEffect(() => {
    if (!dados) return;
    const chamadas = dados.chamadas;
    if (vistas.current === null) {
      vistas.current = new Map(chamadas.map((c) => [c.id, c.chamadaEm]));
      return; // primeira carga (ou cache): não repete chamadas antigas
    }
    const novas = chamadas
      .filter((c) => vistas.current.get(c.id) !== c.chamadaEm)
      .sort((a, b) => a.chamadaEm.localeCompare(b.chamadaEm));
    for (const chamada of novas) {
      vistas.current.set(chamada.id, chamada.chamadaEm);
      if (audioAtivo) falar(textoDaChamada(chamada));
    }
  }, [dados, audioAtivo, falar]);

  function ativarAudio() {
    setAudioAtivo(true);
    falar('Áudio do painel ativado.'); // o clique libera o áudio no navegador
  }

  const chamadas = dados?.chamadas ?? [];
  const [atual, ...anteriores] = chamadas;

  return (
    <main className="painel" id="conteudo">
      <header className="painel-topo">
        <h1>Chamadas</h1>
        <time dateTime={agora.toISOString()}>
          {agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Recife' })}
        </time>
      </header>

      <StatusBanner erro={erro} atualizadoEm={atualizadoEm} rotuloDados="chamadas" />

      <section className="painel-atual" aria-label="Chamada atual" role="status" aria-live="polite">
        {atual ? (
          <>
            <p className="painel-rotulo">{atual.ultimaChamada ? 'Última chamada' : 'Chamando'}</p>
            <p className="painel-numero">{numeroCurto(atual.numero)}</p>
            <p className="painel-guiche">Guichê {atual.guiche}</p>
            <p className="sr-only">{textoDaChamada(atual)}</p>
          </>
        ) : (
          <p className="painel-vazio">
            {dados && !dados.expedienteAberto ? 'Atendimento encerrado' : 'Aguardando chamadas…'}
          </p>
        )}
      </section>

      <section className="painel-anteriores" aria-label="Chamadas anteriores">
        <h2>Anteriores</h2>
        {anteriores.length === 0 ? (
          <p>Nenhuma chamada anterior.</p>
        ) : (
          <ol>
            {anteriores.map((c) => (
              <li key={c.id}>
                <TicketBadge tipo={c.tipo} />
                <strong>{numeroCurto(c.numero)}</strong>
                <span>Guichê {c.guiche}</span>
                <small>{formatarHora(c.chamadaEm)}</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="painel-rodape">
        {suportado && !audioAtivo && <Button onClick={ativarAudio}>Ativar áudio das chamadas</Button>}
        {suportado && audioAtivo && <span>Áudio ativado</span>}
        <Link to="/" className="link-discreto">
          Início
        </Link>
      </footer>
    </main>
  );
}
