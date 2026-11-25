import { useCallback, useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import DataTable from '../../components/DataTable.jsx';
import { api } from '../../services/api.js';
import { mensagemDoErro } from '../../services/http.js';

const VAZIO = { nome: '', usuario: '', senha: '', perfil: 'ATENDENTE' };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [campos, setCampos] = useState(VAZIO);
  const [mensagem, setMensagem] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [redefinindo, setRedefinindo] = useState(null); // { id, senha }

  const carregar = useCallback(async () => {
    try {
      setUsuarios((await api.usuarios()).usuarios);
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
    }
  }, []);

  // Carga inicial (as recargas depois de uma ação usam carregar())
  useEffect(() => {
    let ativo = true;
    api
      .usuarios()
      .then((r) => ativo && setUsuarios(r.usuarios))
      .catch((e) => ativo && setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) }));
    return () => {
      ativo = false;
    };
  }, []);

  const alterar = (evento) => setCampos({ ...campos, [evento.target.name]: evento.target.value });

  async function criar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagem(null);
    try {
      await api.criarUsuario(campos);
      setCampos(VAZIO);
      setMensagem({ tipo: 'sucesso', texto: 'Usuário criado.' });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
    } finally {
      setEnviando(false);
    }
  }

  async function atualizar(id, dados, textoSucesso) {
    setMensagem(null);
    try {
      await api.atualizarUsuario(id, dados);
      setMensagem({ tipo: 'sucesso', texto: textoSucesso });
      setRedefinindo(null);
      await carregar();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDoErro(e) });
    }
  }

  const colunas = [
    { chave: 'nome', titulo: 'Nome' },
    { chave: 'usuario', titulo: 'Login' },
    { chave: 'perfil', titulo: 'Perfil', render: (u) => (u.perfil === 'GESTOR' ? 'Gestor' : 'Atendente') },
    { chave: 'ativo', titulo: 'Situação', render: (u) => (u.ativo ? 'Ativo' : 'Inativo') },
    {
      chave: 'acoes',
      titulo: 'Ações',
      render: (u) =>
        redefinindo?.id === u.id ? (
          <form
            className="formulario-linha"
            onSubmit={(e) => {
              e.preventDefault();
              atualizar(u.id, { senha: redefinindo.senha }, 'Senha redefinida.');
            }}
          >
            <label htmlFor={`nova-senha-${u.id}`} className="sr-only">
              Nova senha de {u.nome}
            </label>
            <input
              id={`nova-senha-${u.id}`}
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="Nova senha (mín. 8)"
              value={redefinindo.senha}
              onChange={(e) => setRedefinindo({ id: u.id, senha: e.target.value })}
              required
              autoFocus
            />
            <Button type="submit">Salvar</Button>
            <Button variante="secundario" onClick={() => setRedefinindo(null)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <div className="acoes">
            <Button
              variante="secundario"
              onClick={() =>
                atualizar(u.id, { ativo: !u.ativo }, u.ativo ? 'Usuário desativado.' : 'Usuário ativado.')
              }
            >
              {u.ativo ? 'Desativar' : 'Ativar'}
              <span className="sr-only"> {u.nome}</span>
            </Button>
            <Button variante="secundario" onClick={() => setRedefinindo({ id: u.id, senha: '' })}>
              Redefinir senha<span className="sr-only"> de {u.nome}</span>
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <h1>Usuários</h1>
      <p className="ajuda">O sistema admite um único gestor ativo; os demais usuários são atendentes.</p>

      <form className="cartao formulario" onSubmit={criar} aria-labelledby="titulo-novo-usuario">
        <h2 id="titulo-novo-usuario">Novo usuário</h2>
        <label htmlFor="nome">Nome completo</label>
        <input id="nome" name="nome" value={campos.nome} onChange={alterar} minLength={3} required />

        <label htmlFor="login">Login</label>
        <input
          id="login"
          name="usuario"
          value={campos.usuario}
          onChange={alterar}
          minLength={3}
          autoComplete="off"
          required
        />

        <label htmlFor="senha-nova">Senha inicial (mínimo 8 caracteres)</label>
        <input
          id="senha-nova"
          name="senha"
          type="password"
          value={campos.senha}
          onChange={alterar}
          minLength={8}
          autoComplete="new-password"
          required
        />

        <label htmlFor="perfil">Perfil</label>
        <select id="perfil" name="perfil" value={campos.perfil} onChange={alterar}>
          <option value="ATENDENTE">Atendente</option>
          <option value="GESTOR">Gestor</option>
        </select>

        <Button type="submit" carregando={enviando}>
          Criar usuário
        </Button>
      </form>

      <div aria-live="polite" role="status">
        {mensagem && <p className={`mensagem mensagem-${mensagem.tipo}`}>{mensagem.texto}</p>}
      </div>
      <DataTable legenda="Usuários cadastrados" colunas={colunas} linhas={usuarios} />
    </>
  );
}
