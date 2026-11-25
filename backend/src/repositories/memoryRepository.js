import { ESTADOS, ESTADOS_ABERTOS } from '../domain/estados.js';

/**
 * Repositório em memória. Mesma interface do repositório MySQL.
 * Usado nos testes automatizados e em demonstrações sem banco (DB_DRIVER=memory).
 * Os dados são perdidos ao reiniciar o processo.
 *
 * A "trava" (comTrava) é um mutex: uma operação por vez, como o
 * SELECT ... FOR UPDATE em fila_estado faz no MySQL. Se a operação falhar,
 * o estado é restaurado (equivalente ao ROLLBACK).
 */
export function criarMemoryRepository() {
  const estado = {
    usuarios: [],
    guiches: [],
    senhas: [],
    eventos: [],
    sequencias: new Map(),
    ultimoTipo: null,
    proximoId: { usuario: 1, guiche: 1, senha: 1, evento: 1 },
  };

  let cadeia = Promise.resolve();

  const guicheDe = (id) => estado.guiches.find((g) => g.id === id);
  const usuarioDe = (id) => estado.usuarios.find((u) => u.id === id);

  const comJuncoes = (senha) => ({
    ...senha,
    guiche_numero: senha.guiche_id ? (guicheDe(senha.guiche_id)?.numero ?? null) : null,
    atendente_nome: senha.atendente_id ? (usuarioDe(senha.atendente_id)?.nome ?? null) : null,
  });

  const clonarEstado = () => structuredClone(estado);
  const restaurarEstado = (copia) => {
    for (const chave of Object.keys(copia)) estado[chave] = copia[chave];
  };

  const contagemFila = (data) => {
    const contagem = { SP: 0, SE: 0, SG: 0 };
    for (const s of estado.senhas) {
      if (s.estado === ESTADOS.AGUARDANDO && s.data_emissao === data) contagem[s.tipo] += 1;
    }
    return contagem;
  };

  const tx = {
    async lerUltimoTipo() {
      return estado.ultimoTipo;
    },
    async salvarUltimoTipo(tipo) {
      estado.ultimoTipo = tipo;
    },
    async proximoSequencial(data, tipo) {
      const chave = `${data}|${tipo}`;
      const proximo = (estado.sequencias.get(chave) ?? 0) + 1;
      estado.sequencias.set(chave, proximo);
      return proximo;
    },
    async inserirSenha(dados) {
      const id = estado.proximoId.senha++;
      estado.senhas.push({
        id,
        guiche_id: null,
        atendente_id: null,
        num_chamadas: 0,
        primeira_chamada_em: null,
        segunda_chamada_em: null,
        ultima_chamada_em: null,
        inicio_atendimento_em: null,
        fim_atendimento_em: null,
        ...dados,
      });
      return id;
    },
    async buscarSenha(id) {
      const senha = estado.senhas.find((s) => s.id === Number(id));
      return senha ? comJuncoes(senha) : null;
    },
    async primeiraDaFila(tipo, data) {
      const fila = estado.senhas
        .filter((s) => s.estado === ESTADOS.AGUARDANDO && s.tipo === tipo && s.data_emissao === data)
        .sort((a, b) => a.emitida_em - b.emitida_em || a.id - b.id);
      return fila[0] ? comJuncoes(fila[0]) : null;
    },
    async contagemFila(data) {
      return contagemFila(data);
    },
    async atualizarSenha(id, patch) {
      const senha = estado.senhas.find((s) => s.id === Number(id));
      Object.assign(senha, patch);
    },
    async registrarEvento(evento) {
      estado.eventos.push({
        id: estado.proximoId.evento++,
        estado_anterior: null,
        usuario_id: null,
        guiche_id: null,
        ...evento,
      });
    },
    async atendimentoAbertoDoUsuario(usuarioId) {
      const senha = estado.senhas.find(
        (s) => s.atendente_id === usuarioId && ESTADOS_ABERTOS.includes(s.estado),
      );
      return senha ? comJuncoes(senha) : null;
    },
    async atendimentoAbertoDoGuiche(guicheId) {
      const senha = estado.senhas.find(
        (s) => s.guiche_id === guicheId && ESTADOS_ABERTOS.includes(s.estado),
      );
      return senha ? comJuncoes(senha) : null;
    },
    async descartarAguardando({ hoje, aposExpediente, em }) {
      const alvo = estado.senhas.filter(
        (s) => s.estado === ESTADOS.AGUARDANDO && (s.data_emissao < hoje || aposExpediente),
      );
      for (const senha of alvo) {
        senha.estado = ESTADOS.DESCARTADA;
        estado.eventos.push({
          id: estado.proximoId.evento++,
          senha_id: senha.id,
          estado_anterior: ESTADOS.AGUARDANDO,
          estado_novo: ESTADOS.DESCARTADA,
          usuario_id: null,
          guiche_id: null,
          ocorrido_em: em,
        });
      }
      return alvo.length;
    },
  };

  return {
    nome: 'memory',

    async comTrava(fn) {
      const anterior = cadeia;
      let liberar;
      cadeia = new Promise((resolve) => {
        liberar = resolve;
      });
      await anterior;
      const copia = clonarEstado();
      try {
        return await fn(tx);
      } catch (erro) {
        restaurarEstado(copia);
        throw erro;
      } finally {
        liberar();
      }
    },

    async contagemFila(data) {
      return contagemFila(data);
    },

    atendimentoAbertoDoUsuario: (usuarioId) => tx.atendimentoAbertoDoUsuario(usuarioId),

    async ultimasChamadas(limite, data) {
      return estado.senhas
        .filter((s) => s.ultima_chamada_em && s.data_emissao === data)
        .sort((a, b) => b.ultima_chamada_em - a.ultima_chamada_em || b.id - a.id)
        .slice(0, limite)
        .map(comJuncoes);
    },

    async senhasPorPeriodo(inicio, fimExclusivo) {
      return estado.senhas
        .filter((s) => s.data_emissao >= inicio && s.data_emissao < fimExclusivo)
        .sort((a, b) => a.emitida_em - b.emitida_em || a.id - b.id)
        .map(comJuncoes);
    },

    async eventosDaSenha(senhaId) {
      return estado.eventos.filter((e) => e.senha_id === senhaId);
    },

    // ---- usuários ----
    async listarUsuarios() {
      return estado.usuarios.map((u) => ({ ...u }));
    },
    async buscarUsuario(id) {
      const u = usuarioDe(Number(id));
      return u ? { ...u } : null;
    },
    async buscarUsuarioPorUsername(username) {
      const u = estado.usuarios.find((x) => x.username.toLowerCase() === username.toLowerCase());
      return u ? { ...u } : null;
    },
    async criarUsuario({ nome, username, senha_hash, perfil }) {
      const usuario = {
        id: estado.proximoId.usuario++,
        nome,
        username,
        senha_hash,
        perfil,
        ativo: 1,
      };
      estado.usuarios.push(usuario);
      return usuario.id;
    },
    async atualizarUsuario(id, patch) {
      Object.assign(usuarioDe(Number(id)), patch);
    },
    async contarGestoresAtivos(exetoId = null) {
      return estado.usuarios.filter((u) => u.perfil === 'GESTOR' && u.ativo && u.id !== exetoId)
        .length;
    },

    // ---- guichês ----
    async listarGuiches() {
      return estado.guiches.map((g) => ({ ...g })).sort((a, b) => a.numero - b.numero);
    },
    async buscarGuiche(id) {
      const g = guicheDe(Number(id));
      return g ? { ...g } : null;
    },
    async buscarGuichePorNumero(numero) {
      const g = estado.guiches.find((x) => x.numero === Number(numero));
      return g ? { ...g } : null;
    },
    async criarGuiche({ numero }) {
      const guiche = { id: estado.proximoId.guiche++, numero: Number(numero), ativo: 1 };
      estado.guiches.push(guiche);
      return guiche.id;
    },
    async atualizarGuiche(id, patch) {
      Object.assign(guicheDe(Number(id)), patch);
    },

    async health() {
      return true;
    },
    async fechar() {},
  };
}
