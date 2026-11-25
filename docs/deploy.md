# Hospedagem do nassauTickets

Um **único serviço** roda tudo: o Express serve a API (`/api`) e o frontend buildado (React) na mesma URL — sem CORS e sem segundo deploy. O banco é um **MySQL gerenciado** à parte.

```
Navegador ──HTTPS──> Render (Docker: Express + frontend) ──TLS──> MySQL gerenciado
```

> **Não validado:** o driver MySQL ainda nunca rodou contra um banco real (ver `docs/requirements/plano-de-testes.md`, seção 3). O primeiro deploy é também essa validação: acompanhe os logs e execute o checklist.

## 1. Banco MySQL (escolha um)

| Opção | Observação |
|-------|-----------|
| **Aiven for MySQL** (plano grátis) | MySQL 8 de verdade, TLS obrigatório. Recomendado. |
| **TiDB Cloud Serverless** | Compatível com MySQL; pode divergir em `SELECT … FOR UPDATE` e na collation `utf8mb4_0900_ai_ci`. Como a fila depende dessa trava, prefira MySQL 8 real. |
| Railway MySQL | Simples, mas o plano grátis é limitado a créditos. |

Anote: **host, porta, usuário, senha e nome do database**. Crie o database vazio (o `migrate` cria só as tabelas).

## 2. Serviço web no Render

1. Render → **New → Web Service** → conecte o repositório `Daniellyv/nassauTickets`, branch **`main`** (depois do merge da `dev`).
2. **Runtime:** Docker. **Dockerfile Path:** `backend/Dockerfile`. **Docker Build Context Directory:** `.` (raiz do repositório).
3. **Health Check Path:** `/api/health`.
4. **Environment** (todas obrigatórias, salvo indicação):

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string aleatória longa (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `DB_DRIVER` | `mysql` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | dados do banco |
| `DB_SSL` | `true` |
| `SEED_GESTOR_SENHA` | senha forte (não use a padrão) |
| `SEED_ATENDENTE_SENHA` | senha forte |
| `CORS_ORIGIN` | opcional (mesma origem não precisa de CORS) |
| `ENFORCE_EXPEDIENTE` | `false` para demonstrar fora das 07:00–17:00; `true` no uso real |

Não defina `PORT`: o Render injeta.

Na subida, o container executa `npm run start:prod`: `migrate` (cria tabelas, idempotente) → `seed` (cria gestor, atendente e guichês se não existirem) → API.

> O plano grátis do Render **hiberna** após ~15 min sem acesso (primeira requisição leva ~50 s). Abra a URL antes de apresentar. Como o painel consulta a cada 2 s, ele mantém o serviço acordado enquanto estiver aberto.

## 3. Validar após o deploy

1. `https://<app>.onrender.com/api/health` → `{"status":"ok","banco":"ok"}` (`banco: ok` prova a conexão com o MySQL).
2. `/totem` → emitir SP, SG e SE; conferir numeração `YYMMDD-PPSQ`.
3. `/login` com o gestor → criar atendente/guichê; `/atendente` → chamar, iniciar, finalizar.
4. `/painel` → últimas chamadas e áudio.
5. **Concorrência (o ponto que nunca rodou em MySQL real):** dois atendentes (duas abas, dois guichês) clicando em "Chamar próxima" ao mesmo tempo nunca recebem a mesma senha. O roteiro completo está na seção 3 do plano de testes.
6. `/gestor/relatorios` e auditoria → exportar CSV.

Se algo falhar, registre a saída dos logs do Render e corrija o `mysqlRepository.js`.

## 4. Testar a imagem localmente (opcional, exige Docker)

```bash
docker build -f backend/Dockerfile -t nassautickets .
docker run --rm -p 3000:3000 -e DB_DRIVER=memory -e JWT_SECRET=teste nassautickets node src/server.js
# http://localhost:3000
```

(`DB_DRIVER=memory` dispensa banco; os dados somem ao reiniciar.)

## 5. Segurança e LGPD

- Troque `SEED_*_SENHA` e `JWT_SECRET`; nunca versione `.env`.
- O cliente do totem é anônimo (nenhum dado pessoal); só usuários do sistema têm credenciais (hash bcrypt).
- O Render fornece HTTPS automaticamente.
