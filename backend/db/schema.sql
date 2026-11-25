-- nassauTickets - Esquema do banco de dados (MySQL 8.0)
-- Carregado automaticamente pelo container (docker-compose) na primeira subida.
-- Para aplicar manualmente: mysql -u root -p < db/schema.sql
--
-- Convenções:
--   * Todos os instantes (DATETIME(3)) são gravados em UTC.
--   * "data_emissao" é a data local do laboratório (America/Recife), usada nos relatórios
--     e na numeração YYMMDD-PPSQ.

CREATE DATABASE IF NOT EXISTS nassautickets
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE nassautickets;

CREATE TABLE IF NOT EXISTS usuarios (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(120) NOT NULL,
  username    VARCHAR(50)  NOT NULL,
  senha_hash  VARCHAR(100) NOT NULL,
  perfil      ENUM('ATENDENTE', 'GESTOR') NOT NULL,
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_username (username)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS guiches (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero  SMALLINT UNSIGNED NOT NULL,
  ativo   TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_guiches_numero (numero)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS senhas (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero                 VARCHAR(12) NOT NULL COMMENT 'YYMMDD-PPSQ',
  tipo                   ENUM('SP', 'SG', 'SE') NOT NULL,
  sequencia              SMALLINT UNSIGNED NOT NULL COMMENT 'SQ: sequência por tipo, reinicia por dia',
  data_emissao           DATE NOT NULL,
  estado                 ENUM('EMITIDA', 'AGUARDANDO', 'CHAMADA', 'CHAMADA_NOVAMENTE',
                              'EM_ATENDIMENTO', 'ATENDIDA', 'NAO_COMPARECEU', 'DESCARTADA') NOT NULL,
  emitida_em             DATETIME(3) NOT NULL,
  guiche_id              INT UNSIGNED NULL,
  atendente_id           INT UNSIGNED NULL,
  num_chamadas           TINYINT UNSIGNED NOT NULL DEFAULT 0,
  primeira_chamada_em    DATETIME(3) NULL,
  segunda_chamada_em     DATETIME(3) NULL,
  ultima_chamada_em      DATETIME(3) NULL,
  inicio_atendimento_em  DATETIME(3) NULL,
  fim_atendimento_em     DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_senhas_numero (numero),
  UNIQUE KEY uq_senhas_dia_tipo_seq (data_emissao, tipo, sequencia),
  KEY ix_senhas_fila (estado, tipo, emitida_em),
  KEY ix_senhas_data (data_emissao),
  KEY ix_senhas_ultima_chamada (ultima_chamada_em),
  KEY ix_senhas_atendente (atendente_id, estado),
  CONSTRAINT fk_senhas_guiche FOREIGN KEY (guiche_id) REFERENCES guiches (id),
  CONSTRAINT fk_senhas_atendente FOREIGN KEY (atendente_id) REFERENCES usuarios (id)
) ENGINE = InnoDB;

-- Contador atômico da sequência (SQ) por dia e tipo.
CREATE TABLE IF NOT EXISTS sequencias_diarias (
  data    DATE NOT NULL,
  tipo    ENUM('SP', 'SG', 'SE') NOT NULL,
  ultimo  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (data, tipo)
) ENGINE = InnoDB;

-- Linha única usada como trava global das operações de fila (concorrência)
-- e para lembrar o tipo da última senha chamada (regra de alternância).
CREATE TABLE IF NOT EXISTS fila_estado (
  id           TINYINT UNSIGNED NOT NULL,
  ultimo_tipo  ENUM('SP', 'SG', 'SE') NULL,
  PRIMARY KEY (id)
) ENGINE = InnoDB;

INSERT IGNORE INTO fila_estado (id, ultimo_tipo) VALUES (1, NULL);

-- Trilha de auditoria: uma linha por mudança de estado. Somente inserção.
CREATE TABLE IF NOT EXISTS eventos_senha (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  senha_id         BIGINT UNSIGNED NOT NULL,
  estado_anterior  VARCHAR(20) NULL,
  estado_novo      VARCHAR(20) NOT NULL,
  usuario_id       INT UNSIGNED NULL,
  guiche_id        INT UNSIGNED NULL,
  ocorrido_em      DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_eventos_senha (senha_id, ocorrido_em),
  CONSTRAINT fk_eventos_senha FOREIGN KEY (senha_id) REFERENCES senhas (id)
) ENGINE = InnoDB;
