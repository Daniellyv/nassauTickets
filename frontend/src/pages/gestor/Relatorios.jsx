import { useCallback, useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import DataTable from '../../components/DataTable.jsx';
import TicketBadge from '../../components/TicketBadge.jsx';
import { api } from '../../services/api.js';
import { mensagemDoErro } from '../../services/http.js';
import {
  formatarDataHora,
  formatarDuracao,
  hojeIso,
  nomeDoTipo,
  ROTULOS_ESTADO,
} from '../../utils/formatar.js';

function Indicador({ titulo, valor }) {
  return (
    <div className="indicador">
      <dt>{titulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/** Busca resumo, detalhado e auditoria do período em paralelo. */
async function buscarRelatorio(consulta) {
  const [resumo, detalhado, auditoria] = await Promise.all([
    api.relatorioResumo(consulta),
    api.relatorioDetalhado(consulta),
    api.relatorioAuditoria(consulta),
  ]);
  return { resumo, detalhado: detalhado.itens, auditoria: auditoria.itens, consulta };
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  const [modo, setModo] = useState('diario');
  const [data, setData] = useState(hojeIso);
  const [mes, setMes] = useState(() => hojeIso().slice(0, 7));
  const [relatorio, setRelatorio] = useState(null);
  const [aba, setAba] = useState('resumo');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const periodo = modo === 'diario' ? { data } : { mes };

  const gerar = useCallback(async (consulta) => {
    setCarregando(true);
    setErro('');
    try {
      setRelatorio(await buscarRelatorio(consulta));
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  // Ao abrir a tela, mostra o relatório do dia
  useEffect(() => {
    let ativo = true;
    buscarRelatorio({ data: hojeIso() })
      .then((resultado) => ativo && setRelatorio(resultado))
      .catch((e) => ativo && setErro(mensagemDoErro(e)));
    return () => {
      ativo = false;
    };
  }, []);

  const submeter = (evento) => {
    evento.preventDefault();
    gerar(periodo);
  };

  async function exportar(tipo) {
    try {
      const blob = await api.baixarCsv(tipo, relatorio.consulta);
      const ref = relatorio.consulta.mes ?? relatorio.consulta.data;
      baixar(blob, `${tipo}-${ref}.csv`);
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }

  const r = relatorio?.resumo;
  const maiorHora = r ? Math.max(1, ...r.desempenho.porHora.map((h) => h.atendidas)) : 1;

  return (
    <>
      <h1>Relatórios</h1>

      <form className="cartao formulario formulario-linha" onSubmit={submeter}>
        <fieldset>
          <legend>Período</legend>
          <label>
            <input type="radio" name="modo" checked={modo === 'diario'} onChange={() => setModo('diario')} />{' '}
            Diário
          </label>
          <label>
            <input type="radio" name="modo" checked={modo === 'mensal'} onChange={() => setModo('mensal')} />{' '}
            Mensal
          </label>
        </fieldset>
        {modo === 'diario' ? (
          <div>
            <label htmlFor="data">Data</label>
            <input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
        ) : (
          <div>
            <label htmlFor="mes">Mês</label>
            <input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
          </div>
        )}
        <Button type="submit" carregando={carregando}>
          Gerar relatório
        </Button>
      </form>

      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}

      {r && (
        <>
          <div className="abas" role="tablist" aria-label="Seções do relatório">
            {[
              ['resumo', 'Resumo'],
              ['detalhado', 'Detalhado'],
              ['auditoria', 'Auditoria'],
            ].map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`aba-${id}`}
                aria-selected={aba === id}
                aria-controls={`painel-${id}`}
                className={aba === id ? 'aba aba-ativa' : 'aba'}
                onClick={() => setAba(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {aba === 'resumo' && (
            <section id="painel-resumo" role="tabpanel" aria-labelledby="aba-resumo">
              <h2>
                {r.periodo.tipo === 'diario' ? 'Resumo do dia' : 'Resumo do mês'} {r.periodo.referencia}
              </h2>
              <dl className="indicadores">
                <Indicador titulo="Senhas emitidas" valor={r.totais.emitidas} />
                <Indicador titulo="Senhas atendidas" valor={r.totais.atendidas} />
                <Indicador titulo="Não compareceram" valor={r.totais.naoCompareceu} />
                <Indicador titulo="Descartadas" valor={r.totais.descartadas} />
                <Indicador titulo="TM geral" valor={formatarDuracao(r.tm.geral)} />
                <Indicador titulo="Espera média" valor={formatarDuracao(r.desempenho.esperaMediaSegundos)} />
                <Indicador titulo="Taxa de atendimento" valor={`${r.desempenho.taxaAtendimento}%`} />
                <Indicador
                  titulo="Taxa de não comparecimento"
                  valor={`${r.desempenho.taxaNaoComparecimento}%`}
                />
              </dl>

              <h3>Por prioridade</h3>
              <DataTable
                legenda="Quantitativo e tempo médio de atendimento por prioridade"
                colunas={[
                  { chave: 'tipo', titulo: 'Tipo', render: (l) => <TicketBadge tipo={l.tipo} mostrarNome /> },
                  { chave: 'emitidas', titulo: 'Emitidas' },
                  { chave: 'atendidas', titulo: 'Atendidas' },
                  { chave: 'naoCompareceu', titulo: 'Não compareceram' },
                  { chave: 'descartadas', titulo: 'Descartadas' },
                  { chave: 'tm', titulo: 'TM', render: (l) => formatarDuracao(r.tm.porTipo[l.tipo]) },
                ]}
                linhas={['SP', 'SE', 'SG'].map((tipo) => ({ tipo, ...r.porTipo[tipo] }))}
                chaveLinha={(l) => l.tipo}
              />

              <h3>Desempenho por atendente</h3>
              <DataTable
                legenda="Atendimentos concluídos e TM por atendente"
                colunas={[
                  { chave: 'atendente', titulo: 'Atendente' },
                  { chave: 'atendidas', titulo: 'Atendidas' },
                  { chave: 'tm', titulo: 'TM', render: (l) => formatarDuracao(l.tmSegundos) },
                ]}
                linhas={r.desempenho.porAtendente}
                chaveLinha={(l) => l.atendente}
                vazio="Nenhum atendimento concluído no período."
              />

              <h3>Atendimentos por hora</h3>
              {r.desempenho.porHora.length === 0 ? (
                <p>Sem atendimentos no período.</p>
              ) : (
                <ul className="barras" aria-label="Atendimentos concluídos por hora do dia">
                  {r.desempenho.porHora.map((h) => (
                    <li key={h.hora}>
                      <span className="barra-rotulo">{String(h.hora).padStart(2, '0')}h</span>
                      <span
                        className="barra"
                        style={{ width: `${(h.atendidas / maiorHora) * 100}%` }}
                        aria-hidden="true"
                      />
                      <span className="barra-valor">{h.atendidas}</span>
                    </li>
                  ))}
                </ul>
              )}

              {r.periodo.tipo === 'mensal' && (
                <>
                  <h3>Por dia</h3>
                  <DataTable
                    legenda="Senhas emitidas e atendidas por dia"
                    colunas={[
                      { chave: 'data', titulo: 'Data' },
                      { chave: 'emitidas', titulo: 'Emitidas' },
                      { chave: 'atendidas', titulo: 'Atendidas' },
                    ]}
                    linhas={r.desempenho.porDia}
                    chaveLinha={(l) => l.data}
                  />
                </>
              )}
            </section>
          )}

          {aba === 'detalhado' && (
            <section id="painel-detalhado" role="tabpanel" aria-labelledby="aba-detalhado">
              <div className="cabecalho-secao">
                <h2>Senhas do período</h2>
                <Button variante="secundario" onClick={() => exportar('detalhado')}>
                  Exportar CSV
                </Button>
              </div>
              <DataTable
                legenda="Relatório detalhado das senhas"
                colunas={[
                  { chave: 'numero', titulo: 'Senha' },
                  { chave: 'tipo', titulo: 'Tipo', render: (l) => nomeDoTipo(l.tipo) },
                  { chave: 'estado', titulo: 'Situação', render: (l) => ROTULOS_ESTADO[l.estado] },
                  { chave: 'emitidaEm', titulo: 'Emissão', render: (l) => formatarDataHora(l.emitidaEm) },
                  { chave: 'atendidaEm', titulo: 'Atendimento', render: (l) => formatarDataHora(l.atendidaEm) },
                  { chave: 'guiche', titulo: 'Guichê' },
                ]}
                linhas={relatorio.detalhado}
                chaveLinha={(l) => l.numero}
                vazio="Nenhuma senha emitida no período."
              />
            </section>
          )}

          {aba === 'auditoria' && (
            <section id="painel-auditoria" role="tabpanel" aria-labelledby="aba-auditoria">
              <div className="cabecalho-secao">
                <h2>Auditoria dos atendimentos</h2>
                <Button variante="secundario" onClick={() => exportar('auditoria')}>
                  Exportar CSV
                </Button>
              </div>
              <DataTable
                legenda="Relatório de auditoria"
                colunas={[
                  { chave: 'atendente', titulo: 'Atendente' },
                  { chave: 'guiche', titulo: 'Guichê' },
                  { chave: 'senha', titulo: 'Senha' },
                  { chave: 'estadoFinal', titulo: 'Situação final', render: (l) => ROTULOS_ESTADO[l.estadoFinal] },
                  { chave: 'primeiraChamadaEm', titulo: '1ª chamada', render: (l) => formatarDataHora(l.primeiraChamadaEm) },
                  { chave: 'segundaChamadaEm', titulo: '2ª chamada', render: (l) => formatarDataHora(l.segundaChamadaEm) },
                  { chave: 'inicioAtendimentoEm', titulo: 'Início', render: (l) => formatarDataHora(l.inicioAtendimentoEm) },
                  { chave: 'fimAtendimentoEm', titulo: 'Fim', render: (l) => formatarDataHora(l.fimAtendimentoEm) },
                ]}
                linhas={relatorio.auditoria}
                chaveLinha={(l) => l.senha}
                vazio="Nenhuma chamada registrada no período."
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
