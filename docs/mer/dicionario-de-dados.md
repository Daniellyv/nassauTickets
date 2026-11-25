# Dicionário de dados

Banco `nassautickets` · MySQL 8.0 · `utf8mb4`. Todos os instantes (`DATETIME(3)`) são gravados em **UTC**.

## usuarios

Atendentes e o gestor.

| Coluna | Tipo | Nulo | Descrição |
|--------|------|:----:|-----------|
| id | INT UNSIGNED, PK, auto | não | Identificador |
| nome | VARCHAR(120) | não | Nome completo |
| username | VARCHAR(50), **único** | não | Login (minúsculas) |
| senha_hash | VARCHAR(100) | não | Hash bcrypt (nunca a senha) |
| perfil | ENUM('ATENDENTE','GESTOR') | não | Perfil. No máximo **um gestor ativo** (regra da aplicação) |
| ativo | TINYINT(1) | não | 1 = ativo; 0 = sem acesso |
| criado_em | DATETIME(3) | não | Criação (padrão: agora) |

## guiches

| Coluna | Tipo | Nulo | Descrição |
|--------|------|:----:|-----------|
| id | INT UNSIGNED, PK, auto | não | Identificador |
| numero | SMALLINT UNSIGNED, **único** | não | Número exibido no painel (1–99) |
| ativo | TINYINT(1) | não | 1 = disponível para atendimento |

## senhas

| Coluna | Tipo | Nulo | Descrição |
|--------|------|:----:|-----------|
| id | BIGINT UNSIGNED, PK, auto | não | Identificador |
| numero | VARCHAR(12), **único** | não | `YYMMDD-PPSQ` (ex.: `260325-SP001`) |
| tipo | ENUM('SP','SG','SE') | não | PP do número |
| sequencia | SMALLINT UNSIGNED | não | SQ (1–999), por tipo, reinicia por dia |
| data_emissao | DATE | não | Data local da emissão; define o período dos relatórios |
| estado | ENUM(8) | não | `EMITIDA`, `AGUARDANDO`, `CHAMADA`, `CHAMADA_NOVAMENTE`, `EM_ATENDIMENTO`, `ATENDIDA`, `NAO_COMPARECEU`, `DESCARTADA` |
| emitida_em | DATETIME(3) | não | Instante da emissão |
| guiche_id | INT UNSIGNED, FK → guiches | sim | Guichê que chamou (nulo até a 1ª chamada) |
| atendente_id | INT UNSIGNED, FK → usuarios | sim | Atendente que chamou |
| num_chamadas | TINYINT UNSIGNED | não | 0, 1 ou 2 |
| primeira_chamada_em | DATETIME(3) | sim | 1ª chamada |
| segunda_chamada_em | DATETIME(3) | sim | 2ª chamada ("Chamar novamente") |
| ultima_chamada_em | DATETIME(3) | sim | Última chamada (ordena o painel) |
| inicio_atendimento_em | DATETIME(3) | sim | Início do atendimento |
| fim_atendimento_em | DATETIME(3) | sim | Fim do atendimento (só `ATENDIDA`) |

Restrições: `UNIQUE(numero)`, `UNIQUE(data_emissao, tipo, sequencia)`.
Índices: `(estado, tipo, emitida_em)`, `(data_emissao)`, `(ultima_chamada_em)`, `(atendente_id, estado)`.

## sequencias_diarias

Contador atômico do SQ.

| Coluna | Tipo | Nulo | Descrição |
|--------|------|:----:|-----------|
| data | DATE, PK | não | Data local |
| tipo | ENUM('SP','SG','SE'), PK | não | Tipo |
| ultimo | SMALLINT UNSIGNED | não | Último SQ emitido no dia para o tipo |

## fila_estado

Linha única (`id = 1`).

| Coluna | Tipo | Nulo | Descrição |
|--------|------|:----:|-----------|
| id | TINYINT UNSIGNED, PK | não | Sempre 1 |
| ultimo_tipo | ENUM('SP','SG','SE') | sim | Tipo da última senha chamada (regra de alternância). A linha também é **bloqueada** (`FOR UPDATE`) para serializar as operações da fila |

## eventos_senha

Trilha de auditoria — somente inserção.

| Coluna | Tipo | Nulo | Descrição |
|--------|------|:----:|-----------|
| id | BIGINT UNSIGNED, PK, auto | não | Identificador |
| senha_id | BIGINT UNSIGNED, FK → senhas | não | Senha afetada |
| estado_anterior | VARCHAR(20) | sim | Nulo na criação |
| estado_novo | VARCHAR(20) | não | Estado depois da transição |
| usuario_id | INT UNSIGNED | sim | Quem agiu (nulo para ações do sistema) |
| guiche_id | INT UNSIGNED | sim | Guichê envolvido |
| ocorrido_em | DATETIME(3) | não | Instante da transição |

Índice: `(senha_id, ocorrido_em)`.

## Regras refletidas no banco

| Regra | Mecanismo |
|-------|-----------|
| Número único | `UNIQUE(numero)` e `UNIQUE(data_emissao, tipo, sequencia)` |
| Máximo de 999 senhas por tipo/dia | Verificado pela aplicação (SQ tem 3 dígitos) |
| Um gestor ativo | Verificado pela aplicação (`cadastroService`) |
| Uma senha aberta por atendente/guichê | Verificado pela aplicação, dentro da transação com trava |
| Máquina de estados | Verificada pela aplicação (`domain/estados.js`); o banco só restringe os valores possíveis |
