import mysql from 'mysql2/promise';
import { ESTADOS, ESTADOS_ABERTOS } from '../domain/estados.js';
import { env } from '../config/env.js';

const SELECT_SENHA = `
  SELECT s.*, g.numero AS guiche_numero, u.nome AS atendente_nome
  FROM senhas s
  LEFT JOIN guiches g ON g.id = s.guiche_id
  LEFT JOIN usuarios u ON u.id = s.atendente_id`;

const COLUNAS_SENHA_ATUALIZAVEIS = new Set([
  'estado',
  'guiche_id',
  'atendente_id',
  'num_chamadas',
  'primeira_chamada_em',
  'segunda_chamada_em',
  'ultima_chamada_em',
  'inicio_atendimento_em',
  'fim_atendimento_em',
]);

const COLUNAS_USUARIO_ATUALIZAVEIS = new Set(['nome', 'senha_hash', 'perfil', 'ativo']);
const COLUNAS_GUICHE_ATUALIZAVEIS = new Set(['ativo']);

function montarSet(patch, permitidas) {
  const campos = Object.keys(patch).filter((campo) => permitidas.has(campo));
  if (campos.length === 0) return null;
  return {
    sql: campos.map((campo) => `${campo} = ?`).join(', '),
    valores: campos.map((campo) => patch[campo]),
  };
}

const marcadores = (lista) => lista.map(() => '?').join(', ');

/**
 * Repositório MySQL 8.0 (driver oficial do projeto).
 *
 * Concorrência: toda operação que altera a fila roda em comTrava(), que abre uma
 * transação e bloqueia a linha única de fila_estado (SELECT ... FOR UPDATE).
 * Duas chamadas simultâneas são serializadas pelo banco, então nunca recebem a
 * mesma senha nem geram o mesmo número de sequência.
 */
export function criarMysqlRepository(config = env.banco) {
  const pool = mysql.createPool({
    host: config.host,
    port: config.porta,
    user: config.usuario,
    password: config.senha,
    database: config.nome,
    connectionLimit: config.limiteConexoes,
    waitForConnections: true,
    connectTimeout: 5000,
    timezone: 'Z', // instantes gravados e lidos em UTC
    charset: 'utf8mb4',
    // DATE volta como string 'YYYY-MM-DD' (sem conversão de fuso)
    typeCast(campo, next) {
      return campo.type === 'DATE' ? campo.string() : next();
    },
  });

  const um = async (executor, sql, params = []) => {
    const [linhas] = await executor.query(sql, params);
    return linhas[0] ?? null;
  };
  const todos = async (executor, sql, params = []) => (await executor.query(sql, params))[0];

  function criarTx(conn) {
    return {
      async lerUltimoTipo() {
        const linha = await um(conn, 'SELECT ultimo_tipo FROM fila_estado WHERE id = 1');
        return linha?.ultimo_tipo ?? null;
      },
      async salvarUltimoTipo(tipo) {
        await conn.query('UPDATE fila_estado SET ultimo_tipo = ? WHERE id = 1', [tipo]);
      },
      async proximoSequencial(data, tipo) {
        await conn.query(
          `INSERT INTO sequencias_diarias (data, tipo, ultimo) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE ultimo = ultimo + 1`,
          [data, tipo],
        );
        const linha = await um(
          conn,
          'SELECT ultimo FROM sequencias_diarias WHERE data = ? AND tipo = ?',
          [data, tipo],
        );
        return Number(linha.ultimo);
      },
      async inserirSenha(d) {
        const [resultado] = await conn.query(
          `INSERT INTO senhas (numero, tipo, sequencia, data_emissao, estado, emitida_em)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [d.numero, d.tipo, d.sequencia, d.data_emissao, d.estado, d.emitida_em],
        );
        return Number(resultado.insertId);
      },
      async buscarSenha(id) {
        return um(conn, `${SELECT_SENHA} WHERE s.id = ?`, [id]);
      },
      async primeiraDaFila(tipo, data) {
        return um(
          conn,
          `${SELECT_SENHA}
           WHERE s.estado = ? AND s.tipo = ? AND s.data_emissao = ?
           ORDER BY s.emitida_em, s.id LIMIT 1`,
          [ESTADOS.AGUARDANDO, tipo, data],
        );
      },
      async contagemFila(data) {
        return contagemPorTipo(conn, data);
      },
      async atualizarSenha(id, patch) {
        const set = montarSet(patch, COLUNAS_SENHA_ATUALIZAVEIS);
        if (!set) return;
        await conn.query(`UPDATE senhas SET ${set.sql} WHERE id = ?`, [...set.valores, id]);
      },
      async registrarEvento(e) {
        await conn.query(
          `INSERT INTO eventos_senha
             (senha_id, estado_anterior, estado_novo, usuario_id, guiche_id, ocorrido_em)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            e.senha_id,
            e.estado_anterior ?? null,
            e.estado_novo,
            e.usuario_id ?? null,
            e.guiche_id ?? null,
            e.ocorrido_em,
          ],
        );
      },
      async atendimentoAbertoDoUsuario(usuarioId) {
        return um(
          conn,
          `${SELECT_SENHA} WHERE s.atendente_id = ? AND s.estado IN (${marcadores(ESTADOS_ABERTOS)}) LIMIT 1`,
          [usuarioId, ...ESTADOS_ABERTOS],
        );
      },
      async atendimentoAbertoDoGuiche(guicheId) {
        return um(
          conn,
          `${SELECT_SENHA} WHERE s.guiche_id = ? AND s.estado IN (${marcadores(ESTADOS_ABERTOS)}) LIMIT 1`,
          [guicheId, ...ESTADOS_ABERTOS],
        );
      },
      async descartarAguardando({ hoje, aposExpediente, em }) {
        const alvo = await todos(
          conn,
          `SELECT id FROM senhas
           WHERE estado = ? AND (data_emissao < ? OR ?)`,
          [ESTADOS.AGUARDANDO, hoje, aposExpediente ? 1 : 0],
        );
        for (const { id } of alvo) {
          await conn.query('UPDATE senhas SET estado = ? WHERE id = ?', [ESTADOS.DESCARTADA, id]);
          await conn.query(
            `INSERT INTO eventos_senha (senha_id, estado_anterior, estado_novo, ocorrido_em)
             VALUES (?, ?, ?, ?)`,
            [id, ESTADOS.AGUARDANDO, ESTADOS.DESCARTADA, em],
          );
        }
        return alvo.length;
      },
    };
  }

  async function contagemPorTipo(executor, data) {
    const linhas = await todos(
      executor,
      `SELECT tipo, COUNT(*) AS total FROM senhas
       WHERE estado = ? AND data_emissao = ? GROUP BY tipo`,
      [ESTADOS.AGUARDANDO, data],
    );
    const contagem = { SP: 0, SE: 0, SG: 0 };
    for (const { tipo, total } of linhas) contagem[tipo] = Number(total);
    return contagem;
  }

  return {
    nome: 'mysql',

    async comTrava(fn) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM fila_estado WHERE id = 1 FOR UPDATE');
        const resultado = await fn(criarTx(conn));
        await conn.commit();
        return resultado;
      } catch (erro) {
        await conn.rollback().catch(() => {});
        throw erro;
      } finally {
        conn.release();
      }
    },

    contagemFila: (data) => contagemPorTipo(pool, data),

    atendimentoAbertoDoUsuario: (usuarioId) => criarTx(pool).atendimentoAbertoDoUsuario(usuarioId),

    ultimasChamadas(limite, data) {
      return todos(
        pool,
        `${SELECT_SENHA}
         WHERE s.ultima_chamada_em IS NOT NULL AND s.data_emissao = ?
         ORDER BY s.ultima_chamada_em DESC, s.id DESC LIMIT ?`,
        [data, limite],
      );
    },

    senhasPorPeriodo(inicio, fimExclusivo) {
      return todos(
        pool,
        `${SELECT_SENHA}
         WHERE s.data_emissao >= ? AND s.data_emissao < ?
         ORDER BY s.emitida_em, s.id`,
        [inicio, fimExclusivo],
      );
    },

    eventosDaSenha(senhaId) {
      return todos(pool, 'SELECT * FROM eventos_senha WHERE senha_id = ? ORDER BY id', [senhaId]);
    },

    // ---- usuários ----
    listarUsuarios: () => todos(pool, 'SELECT * FROM usuarios ORDER BY nome'),
    buscarUsuario: (id) => um(pool, 'SELECT * FROM usuarios WHERE id = ?', [id]),
    buscarUsuarioPorUsername: (username) =>
      um(pool, 'SELECT * FROM usuarios WHERE username = ?', [username]),
    async criarUsuario({ nome, username, senha_hash, perfil }) {
      const [r] = await pool.query(
        'INSERT INTO usuarios (nome, username, senha_hash, perfil) VALUES (?, ?, ?, ?)',
        [nome, username, senha_hash, perfil],
      );
      return Number(r.insertId);
    },
    async atualizarUsuario(id, patch) {
      const set = montarSet(patch, COLUNAS_USUARIO_ATUALIZAVEIS);
      if (set) await pool.query(`UPDATE usuarios SET ${set.sql} WHERE id = ?`, [...set.valores, id]);
    },
    async contarGestoresAtivos(exetoId = null) {
      const linha = await um(
        pool,
        `SELECT COUNT(*) AS total FROM usuarios
         WHERE perfil = 'GESTOR' AND ativo = 1 AND (? IS NULL OR id <> ?)`,
        [exetoId, exetoId],
      );
      return Number(linha.total);
    },

    // ---- guichês ----
    listarGuiches: () => todos(pool, 'SELECT * FROM guiches ORDER BY numero'),
    buscarGuiche: (id) => um(pool, 'SELECT * FROM guiches WHERE id = ?', [id]),
    buscarGuichePorNumero: (numero) => um(pool, 'SELECT * FROM guiches WHERE numero = ?', [numero]),
    async criarGuiche({ numero }) {
      const [r] = await pool.query('INSERT INTO guiches (numero) VALUES (?)', [numero]);
      return Number(r.insertId);
    },
    async atualizarGuiche(id, patch) {
      const set = montarSet(patch, COLUNAS_GUICHE_ATUALIZAVEIS);
      if (set) await pool.query(`UPDATE guiches SET ${set.sql} WHERE id = ?`, [...set.valores, id]);
    },

    async health() {
      await pool.query('SELECT 1');
      return true;
    },
    async fechar() {
      await pool.end();
    },
  };
}
