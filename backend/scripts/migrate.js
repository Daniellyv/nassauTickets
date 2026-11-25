// Aplica db/schema.sql no banco configurado em DB_* (idempotente: só CREATE ... IF NOT EXISTS).
// Usado no deploy, onde o banco já existe (gerenciado) e o usuário não pode criar/trocar de database.
//   cd backend && npm run migrate
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const { host, porta, usuario, senha, nome, ssl } = env.banco;

// Remove CREATE DATABASE / USE e comentários: o banco vem de DB_NAME.
const bruto = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const comandos = bruto
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((c) => c.trim())
  .filter((c) => c && !/^(CREATE DATABASE|USE)\b/i.test(c));

const conn = await mysql.createConnection({
  host,
  port: porta,
  user: usuario,
  password: senha,
  database: nome,
  connectTimeout: 10000,
  ...(ssl ? { ssl } : {}),
});
try {
  for (const comando of comandos) await conn.query(comando);
  console.log(`Migração concluída em ${host}:${porta}/${nome} (${comandos.length} comandos).`);
} catch (erro) {
  console.error('Falha na migração:', erro.code ?? erro.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
