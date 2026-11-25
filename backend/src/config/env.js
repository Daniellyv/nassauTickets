import { readFileSync } from 'node:fs';
import 'dotenv/config';

const bool = (valor, padrao) => {
  if (valor === undefined || valor === '') return padrao;
  return ['1', 'true', 'sim', 'yes'].includes(String(valor).toLowerCase());
};

/**
 * Opções TLS do MySQL (DB_SSL=true). Bancos gerenciados costumam usar uma CA própria:
 *  - DB_SSL_CA: certificado da CA (conteúdo PEM, aceita "\n" literal se estiver em uma linha)
 *    ou caminho de arquivo (ex.: /etc/secrets/ca.pem via Secret Files do Render). Opção segura.
 *  - DB_SSL_REJECT_UNAUTHORIZED=false: mantém a criptografia mas não valida o certificado.
 */
function opcoesSsl() {
  if (!bool(process.env.DB_SSL, false)) return undefined;
  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: bool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
  };
  const ca = process.env.DB_SSL_CA?.trim();
  if (ca) ssl.ca = ca.includes('BEGIN CERTIFICATE') ? ca.replaceAll('\\n', '\n') : readFileSync(ca, 'utf8');
  return ssl;
}

const producao = process.env.NODE_ENV === 'production';

if (producao && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET é obrigatório em produção.');
}

export const env = {
  producao,
  porta: Number(process.env.PORT ?? 3000),
  // 'mysql' (oficial) ou 'memory' (testes e demonstração sem banco)
  driverBanco: process.env.DB_DRIVER ?? 'mysql',
  banco: {
    host: process.env.DB_HOST ?? 'localhost',
    porta: Number(process.env.DB_PORT ?? 3306),
    usuario: process.env.DB_USER ?? 'nassau',
    senha: process.env.DB_PASSWORD ?? 'nassau_dev',
    nome: process.env.DB_NAME ?? 'nassautickets',
    limiteConexoes: Number(process.env.DB_POOL ?? 10),
    // Bancos gerenciados (Aiven, TiDB, PlanetScale...) exigem TLS: DB_SSL=true
    ssl: opcoesSsl(),
  },
  // Pasta do frontend buildado (frontend/dist). Se existir, o Express a serve junto com a API
  // (um único serviço/URL, sem CORS). Em desenvolvimento o Vite cuida do frontend.
  frontendDist: process.env.FRONTEND_DIST ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'segredo-somente-para-desenvolvimento',
  jwtExpiracao: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigem: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
  fusoHorario: process.env.APP_TIMEZONE ?? 'America/Recife',
  expediente: {
    inicio: process.env.EXPEDIENTE_INICIO ?? '07:00',
    fim: process.env.EXPEDIENTE_FIM ?? '17:00',
    // Em testes/demonstrações pode ser desligado (ENFORCE_EXPEDIENTE=false)
    aplicar: bool(process.env.ENFORCE_EXPEDIENTE, true),
  },
  // Dados iniciais (npm run seed). Troque em qualquer ambiente real.
  seed: {
    gestorUsuario: process.env.SEED_GESTOR_USUARIO ?? 'gestor',
    gestorSenha: process.env.SEED_GESTOR_SENHA ?? 'Gestor@123',
    atendenteUsuario: process.env.SEED_ATENDENTE_USUARIO ?? 'atendente',
    atendenteSenha: process.env.SEED_ATENDENTE_SENHA ?? 'Atendente@123',
    guiches: Number(process.env.SEED_GUICHES ?? 4),
  },
};
