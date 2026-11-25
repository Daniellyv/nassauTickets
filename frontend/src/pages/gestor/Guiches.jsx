import { useCallback, useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import DataTable from '../../components/DataTable.jsx';
import { api } from '../../services/api.js';
import { mensagemDoErro } from '../../services/http.js';

export default function Guiches() {
  const [guiches, setGuiches] = useState([]);
  const [numero, setNumero] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setGuiches((await api.guiches()).guiches);
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
    }
  }, []);

  // Carga inicial (as recargas depois de uma ação usam carregar())
  useEffect(() => {
    let ativo = true;
    api
      .guiches()
      .then((r) => ativo && setGuiches(r.guiches))
      .catch((e) => ativo && setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) }));
    return () => {
      ativo = false;
    };
  }, []);

  async function criar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagem(null);
    try {
      await api.criarGuiche(Number(numero));
      setNumero('');
      setMensagem({ tipo: 'sucesso', texto: `Guichê ${numero} criado.` });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
    } finally {
      setEnviando(false);
    }
  }

  async function alternar(guiche) {
    setMensagem(null);
    try {
      await api.atualizarGuiche(guiche.id, { ativo: !guiche.ativo });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
    }
  }

  const colunas = [
    { chave: 'numero', titulo: 'Guichê', render: (g) => `Guichê ${g.numero}` },
    { chave: 'ativo', titulo: 'Situação', render: (g) => (g.ativo ? 'Ativo' : 'Inativo') },
    {
      chave: 'acoes',
      titulo: 'Ações',
      render: (g) => (
        <Button variante="secundario" onClick={() => alternar(g)}>
          {g.ativo ? 'Desativar' : 'Ativar'}
          <span className="sr-only"> guichê {g.numero}</span>
        </Button>
      ),
    },
  ];

  return (
    <>
      <h1>Guichês</h1>
      <form className="cartao formulario formulario-linha" onSubmit={criar}>
        <div>
          <label htmlFor="numero-guiche">Número do novo guichê</label>
          <input
            id="numero-guiche"
            type="number"
            min="1"
            max="99"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
          />
        </div>
        <Button type="submit" carregando={enviando}>
          Adicionar guichê
        </Button>
      </form>
      <div aria-live="polite" role="status">
        {mensagem && <p className={`mensagem mensagem-${mensagem.tipo}`}>{mensagem.texto}</p>}
      </div>
      <DataTable legenda="Guichês cadastrados" colunas={colunas} linhas={guiches} />
    </>
  );
}
