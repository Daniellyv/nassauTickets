# Requisitos não funcionais

Cada RNF indica como é atendido hoje e como é verificado. Metas ainda **não medidas** estão marcadas como tal — este documento não afirma desempenho que não foi testado.

## Segurança

| ID | Requisito | Como é atendido | Verificação |
|----|-----------|-----------------|-------------|
| RNF-001 | Senhas de usuários armazenadas apenas como hash. | `bcryptjs` (custo 10); a API nunca devolve o hash. | `tests/api.test.js` (login não vaza hash) |
| RNF-002 | Autenticação por token com expiração. | JWT (`jsonwebtoken`), validade `JWT_EXPIRES_IN` (8 h); em produção `JWT_SECRET` é obrigatório (a aplicação não sobe sem ele). | testes de login/401 |
| RNF-003 | Autorização por perfil. | Rotas de cadastro e relatórios exigem GESTOR; rotas do atendente exigem login; totem e painel são públicos e só expõem o necessário. | `tests/api.test.js` ("atendente não acessa cadastros") |
| RNF-004 | Desativação de usuário vale na hora. | O token é revalidado contra o banco a cada requisição. | teste "usuário inativo… token antigo" |
| RNF-005 | Proteção contra força bruta e abuso. | `express-rate-limit`: login (20 / 15 min por IP) e emissão de senha (120 / min por IP). | teste de rate limit |
| RNF-006 | Mitigar vulnerabilidades comuns da Web. | `helmet`; CORS restrito (`CORS_ORIGIN`); corpo JSON limitado a 10 KB; validação de entrada com `zod` (campos extras rejeitados); consultas SQL **parametrizadas**; CSV neutraliza injeção de fórmulas. | testes de validação e CSV |
| RNF-007 | Mensagens de erro sem vazar detalhes internos; login com mesma resposta para usuário inexistente e senha errada. | Manipulador de erros central; hash falso para tempo de resposta equivalente. | teste de login |
| RNF-008 | Segredos fora do código. | `.env` (ignorado pelo Git); `.env.example` com valores de exemplo. | revisão do `.gitignore` |
| RNF-009 | Transporte seguro. | **Pendente de implantação:** a API fala HTTP; em produção deve ficar atrás de proxy reverso com **HTTPS/TLS**. | checklist de implantação |

> **Limitação conhecida.** O token fica em `sessionStorage` do navegador (some ao fechar a aba), o que o expõe a XSS se alguma vulnerabilidade de script for introduzida. A alternativa (cookie `HttpOnly` + proteção CSRF) foi considerada, mas adiada por exigir mesmo domínio/HTTPS na implantação. O React escapa o conteúdo por padrão e não há `dangerouslySetInnerHTML` no código.

## Disponibilidade e recuperação

| ID | Requisito | Como é atendido |
|----|-----------|-----------------|
| RNF-010 | A queda do banco/backend não pode "quebrar" as telas. | Ver [recuperacao-de-desastres.md](recuperacao-de-desastres.md): painel mantém a última lista (cache local) com aviso; totem desabilita emissão e orienta; tentativas com *backoff* até 15 s; recuperação automática. |
| RNF-011 | O backend deve informar sua saúde. | `GET /api/health` verifica o banco (200 `ok` / 503 `degradado`). |
| RNF-012 | Falhas de banco devem virar resposta controlada. | Erros de conexão são convertidos em HTTP 503 `servico_indisponivel`. |
| RNF-013 | Nenhum estado parcial em caso de falha no meio de uma operação. | Operações da fila rodam em **transação** (rollback em erro). |
| RNF-014 | Encerramento limpo. | `SIGINT/SIGTERM` fecham o servidor e o pool de conexões. |
| RNF-015 | Dados duráveis. | MySQL com volume Docker; **backup** do volume/`mysqldump` diário é recomendação de implantação (não automatizada no projeto). |

## Auditoria

| ID | Requisito | Como é atendido |
|----|-----------|-----------------|
| RNF-020 | Toda mudança de estado de senha deve ser registrada. | Tabela `eventos_senha` (estado anterior/novo, usuário, guichê, instante), **somente inserção** (a aplicação nunca atualiza nem apaga). |
| RNF-021 | Relatório de auditoria consultável e exportável. | `/api/relatorios/auditoria` (+ CSV). |
| RNF-022 | Registros de auditoria sem dados pessoais do cliente. | O cliente é anônimo; só constam número da senha, atendente e guichê. |

## Desempenho

Metas de projeto para um laboratório de porte pequeno/médio (centenas de senhas por dia). **Ainda não medidas com carga real** — ver [plano-de-testes.md](plano-de-testes.md#testes-de-desempenho-pendente).

| ID | Meta | Observação |
|----|------|------------|
| RNF-030 | Emitir senha e chamar próxima em menos de 300 ms (percentil 95) em uso normal. | Operações curtas: uma transação com poucas consultas indexadas. |
| RNF-031 | Painel refletir uma chamada em até ~2 s. | Atualização por consulta periódica (*polling*) a cada 2 s. |
| RNF-032 | Suportar 10 guichês simultâneos. | Pool de 10 conexões configurável (`DB_POOL`). |
| RNF-033 | Consultas de relatório mensais em poucos segundos. | Índices por `data_emissao`; agregação em memória (volume pequeno). |

O simulador (`npm run simulate`) já exercita o fluxo com ~190 senhas/dia em memória; a medição com MySQL e carga concorrente está pendente.

## Concorrência

| ID | Requisito | Como é atendido |
|----|-----------|-----------------|
| RNF-040 | Atendentes simultâneos não podem receber a mesma senha. | Toda operação da fila executa sob `SELECT … FOR UPDATE` em `fila_estado` (MySQL) — serialização no banco. Detalhes em [sequencias.md](../models/uml/sequencias.md). |
| RNF-041 | Numeração sem repetição nem lacunas sob concorrência. | Contador `sequencias_diarias` atualizado dentro da mesma transação + chave única `(data_emissao, tipo, sequencia)`. |
| RNF-042 | Um atendente / guichê com uma senha por vez. | Verificado dentro da transação (RN-015). |

Os testes de concorrência (`tests/atendimento.test.js`) rodam com o repositório em memória, que serializa com um *mutex* equivalente. A validação com MySQL real está listada como pendente no plano de testes.

## Usabilidade e acessibilidade

| ID | Requisito | Como é atendido |
|----|-----------|-----------------|
| RNF-050 | Conformidade com **WCAG 2.1 nível AA** e com a legislação brasileira de acessibilidade. | Ver [lgpd-e-acessibilidade.md](lgpd-e-acessibilidade.md). |
| RNF-051 | Totem utilizável por qualquer pessoa. | Botões grandes (≥ 15 rem de altura), texto grande, sigla + nome + cor, tempo de leitura de 30 s. |
| RNF-052 | Painel legível a distância. | Alto contraste (≥ 10:1), fonte até 12 rem, anúncio por voz e `aria-live`. |
| RNF-053 | Interface em português do Brasil. | Textos, datas e números em pt-BR; fuso `America/Recife`. |

## Portabilidade e manutenibilidade

| ID | Requisito | Como é atendido |
|----|-----------|-----------------|
| RNF-060 | Usar a infraestrutura já suportada pelo laboratório. | Node.js LTS 22 + Express, MySQL 8.0, React 19. |
| RNF-061 | Subir o ambiente com poucos comandos. | `docker compose up -d`, `npm run seed`, `npm run dev` (ver README). |
| RNF-062 | Código organizado em camadas. | Backend: `routes → controllers → services → repositories`, com o **domínio** (`domain/`) puro e testável. Frontend: `pages / components / hooks / services / context / utils`. |
| RNF-063 | Trocar o banco sem tocar nas regras. | Interface de repositório com dois drivers: `mysql` (oficial) e `memory` (testes/demo). |
| RNF-064 | Testes automatizados. | Backend: `node --test` (≈ 80 testes). Frontend: Vitest + Testing Library (≈ 20 testes). |
| RNF-065 | Navegadores. | Versões recentes de Chrome, Edge e Firefox. A leitura em voz depende da *Web Speech API* (Chrome/Edge recomendados). |
