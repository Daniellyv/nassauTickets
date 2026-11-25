import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import StatusBanner from '../components/StatusBanner.jsx';
import TicketBadge from '../components/TicketBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { api } from '../services/api.js';
import { mensagemDoErro } from '../services/http.js';
import { numeroCurto, ROTULOS_ESTADO } from '../utils/formatar.js';

function Cronometro({ desde }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const total = Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 1000));
  const texto = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return <span>{texto}</span>;
}

function lerGuicheSalvo(chave) {
  try {
    return Number(localStorage.getItem(chave)) || '';
  } catch {
    return '';
  }
}

export default function Atendente() {
  const { usuario } = useAuth();
  const chaveGuiche = `nt.guiche.${usuario.id}`;

  const [guiches, setGuiches] = useState([]);
  const [guicheId, setGuicheId] = useState(() => lerGuicheSalvo(chaveGuiche));
  const [senha, setSenha] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const filas = usePolling(() => api.filas(), { intervaloMs: 3000 });
  const { recarregar: recarregarFilas } = filas;

  // Ao abrir a tela: carrega guichês e retoma um atendimento que ficou em aberto
  useEffect(() => {
    let ativo = true;
    Promise.all([api.guiches(), api.atendimentoAtual()])
      .then(([g, atual]) => {
        if (!ativo) return;
        setGuiches(g.guiches.filter((x) => x.ativo));
        setSenha(atual.senha);
      })
      .catch((e) => ativo && setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) }))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  const escolherGuiche = (evento) => {
    const valor = Number(evento.target.value) || '';
    setGuicheId(valor);
    try {
      localStorage.setItem(chaveGuiche, String(valor));
    } catch {
      // sem armazenamento local: a escolha vale só nesta tela
    }
  };

  const executar = useCallback(
    async (acao, aoConcluir) => {
      setOcupado(true);
      setMensagem(null);
      try {
        await aoConcluir(await acao());
      } catch (e) {
        setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
        // Estado divergente (ex.: outra aba): ressincroniza com o servidor
        if (['transicao_invalida', 'atendimento_em_aberto'].includes(e.codigo)) {
          api.atendimentoAtual().then((r) => setSenha(r.senha)).catch(() => {});
        }
      } finally {
        setOcupado(false);
        recarregarFilas();
      }
    },
    [recarregarFilas],
  );

  const chamarProxima = () =>
    executar(
      () => api.chamarProxima(Number(guicheId)),
      ({ senha: chamada }) => {
        if (!chamada) {
          setMensagem({ tipo: 'info', texto: 'Não há senhas aguardando no momento.' });
          return;
        }
        setSenha(chamada);
        setMensagem({ tipo: 'sucesso', texto: `Senha ${chamada.numero} chamada no painel.` });
      },
    );

  const chamarNovamente = () =>
    executar(
      () => api.chamarNovamente(senha.id),
      ({ senha: nova }) => {
        setSenha(nova);
        setMensagem({ tipo: 'info', texto: 'Última chamada feita no painel.' });
      },
    );

  const iniciar = () =>
    executar(
      () => api.iniciar(senha.id),
      ({ senha: nova }) => {
        setSenha(nova);
        setMensagem({ tipo: 'sucesso', texto: 'Atendimento iniciado.' });
      },
    );

  const finalizar = () =>
    executar(
      () => api.finalizar(senha.id),
      ({ senha: fim }) => {
        setSenha(null);
        setMensagem({ tipo: 'sucesso', texto: `Atendimento da senha ${fim.numero} finalizado.` });
      },
    );

  const naoCompareceu = () =>
    executar(
      () => api.naoCompareceu(senha.id),
      ({ senha: fim }) => {
        setSenha(null);
        setMensagem({ tipo: 'info', texto: `Senha ${fim.numero} registrada como não compareceu.` });
      },
    );

  const totalNaFila = filas.dados ? Object.values(filas.dados.filas).reduce((a, b) => a + b, 0) : 0;
  const expedienteFechado = filas.dados && !filas.dados.expedienteAberto;

  if (carregando) return <p className="carregando" role="status">Carregando…</p>;

  return (
    <>
      <h1>Atendimento</h1>
      <StatusBanner erro={filas.erro} atualizadoEm={filas.atualizadoEm} rotuloDados="fila" />

      <div className="grade-atendimento">
        <section className="cartao" aria-labelledby="titulo-guiche">
          <h2 id="titulo-guiche">Seu guichê</h2>
          <label htmlFor="guiche">Guichê de atendimento</label>
          <select id="guiche" value={guicheId} onChange={escolherGuiche} disabled={Boolean(senha)}>
            <option value="">Selecione…</option>
            {guiches.map((g) => (
              <option key={g.id} value={g.id}>
                Guichê {g.numero}
              </option>
            ))}
          </select>
          {guiches.length === 0 && (
            <p className="ajuda">Nenhum guichê ativo. Peça ao gestor para cadastrar.</p>
          )}

          <h2>Fila de espera</h2>
          <ul className="lista-filas" aria-label="Senhas aguardando por tipo">
            {['SP', 'SE', 'SG'].map((tipo) => (
              <li key={tipo}>
                <TicketBadge tipo={tipo} mostrarNome />
                <strong>{filas.dados?.filas[tipo] ?? '—'}</strong>
              </li>
            ))}
          </ul>
          {expedienteFechado && <p className="ajuda">Fora do expediente de atendimento.</p>}
        </section>

        <section className="cartao" aria-labelledby="titulo-atual">
          <h2 id="titulo-atual">Senha em atendimento</h2>

          {senha ? (
            <div className="senha-atual">
              <p className="senha-numero">{numeroCurto(senha.numero)}</p>
              <p>
                <TicketBadge tipo={senha.tipo} mostrarNome /> · Guichê {senha.guiche}
              </p>
              <p>
                Situação: <strong>{ROTULOS_ESTADO[senha.estado]}</strong> · Chamadas: {senha.numChamadas}
                {senha.estado === 'EM_ATENDIMENTO' && (
                  <>
                    {' '}
                    · Tempo: <Cronometro desde={senha.inicioAtendimentoEm} />
                  </>
                )}
              </p>

              <div className="acoes">
                {['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(senha.estado) && (
                  <Button onClick={iniciar} carregando={ocupado}>
                    Iniciar atendimento
                  </Button>
                )}
                {senha.estado === 'CHAMADA' && (
                  <Button variante="secundario" onClick={chamarNovamente} disabled={ocupado}>
                    Chamar novamente
                  </Button>
                )}
                {senha.estado === 'CHAMADA_NOVAMENTE' && (
                  <Button variante="perigo" onClick={naoCompareceu} disabled={ocupado}>
                    Não compareceu
                  </Button>
                )}
                {senha.estado === 'EM_ATENDIMENTO' && (
                  <Button onClick={finalizar} carregando={ocupado}>
                    Finalizar atendimento
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="senha-atual">
              <p>Nenhuma senha em atendimento.</p>
              <Button
                onClick={chamarProxima}
                carregando={ocupado}
                disabled={!guicheId || totalNaFila === 0 || expedienteFechado}
              >
                Chamar próxima senha
              </Button>
              {!guicheId && <p className="ajuda">Selecione seu guichê para chamar.</p>}
              {guicheId && totalNaFila === 0 && !expedienteFechado && (
                <p className="ajuda">Aguardando novas senhas.</p>
              )}
            </div>
          )}

          <div aria-live="polite" role="status">
            {mensagem && <p className={`mensagem mensagem-${mensagem.tipo}`}>{mensagem.texto}</p>}
          </div>
        </section>
      </div>
    </>
  );
}
