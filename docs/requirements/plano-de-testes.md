# Plano de testes

Responsáveis: testadores do grupo. Escopo: backend (API), frontend (telas), regras de negócio, segurança, concorrência, acessibilidade e resiliência.

## 1. Estratégia

| Nível | Ferramenta | Onde | O que cobre |
|-------|-----------|------|-------------|
| Unidade (domínio puro) | `node:test` | `backend/tests/dominio.test.js` | priorização, máquina de estados, numeração |
| Integração (serviços + API HTTP) | `node:test` + `supertest` | `backend/tests/*.test.js` | fluxo completo, perfis, validação, expediente, relatórios, CSV, concorrência |
| Componentes e páginas | Vitest + Testing Library | `frontend/src/**/*.test.*` | totem, painel, polling com falha, componentes |
| Manual / exploratório | roteiro da seção 4 | navegador | usabilidade, áudio, acessibilidade, resiliência |

Execução:

```bash
cd backend  && npm test     # 83 testes
cd frontend && npm test     # 21 testes
cd frontend && npm run lint # oxlint
```

## 2. Situação atual (honesta)

| Área | Situação |
|------|----------|
| Backend com repositório **em memória** | ✅ 83 testes passando |
| Frontend | ✅ 21 testes passando; `build` e `lint` limpos |
| Fluxo ponta a ponta com servidor real (API + Vite + proxy) | ✅ verificado manualmente: emissão → chamada → painel; telas de totem e painel conferidas por captura de tela |
| Backend com **MySQL 8.0 real** | ⏳ **NÃO validado.** O driver `mysqlRepository.js` foi escrito, mas o ambiente de desenvolvimento não tinha Docker/MySQL. Executar o roteiro da seção 3 antes de qualquer entrega |
| Concorrência com MySQL (locks) | ⏳ coberta só no driver em memória (mutex equivalente). Validar na seção 3 |
| Desempenho com carga | ⏳ não medido |
| Acessibilidade (leitor de tela, axe) | ⏳ pendente (seção 5) |
| Navegadores (Firefox, Safari) e áudio | ⏳ verificar manualmente (seção 4) |

## 3. Validação com MySQL (obrigatória)

```bash
cd backend
cp .env.example .env
docker compose up -d                  # sobe o MySQL 8.0 e aplica db/schema.sql
docker compose ps                     # aguardar "healthy"
npm install && npm run seed           # cria gestor, atendente e guichês
npm run dev                           # DB_DRIVER=mysql
```

Checklist:

- [ ] `GET /api/health` → `{"status":"ok","banco":"ok"}`
- [ ] Emitir SP, SG, SE e conferir no banco: `SELECT numero, estado FROM senhas;` (formato `YYMMDD-PPSQ`)
- [ ] Reiniciar o backend e verificar que a sequência continua (sem repetir número)
- [ ] Ciclo completo de uma senha e conferir `eventos_senha` (5 linhas)
- [ ] **Concorrência:** com 5+ senhas na fila, disparar 4 `chamar-proxima` simultâneos com 4 usuários/guichês (ex.: `autocannon` ou 4 terminais `curl &`): as 4 senhas devem ser **diferentes**
- [ ] **Concorrência na emissão:** 100 `POST /api/senhas` em paralelo: números únicos e sem lacunas
- [ ] `docker compose stop` → telas em modo indisponível; `docker compose start` → recuperação sozinha
- [ ] `npm run simulate -- --driver=mysql --dias=10` e conferir relatórios diário e mensal na tela
- [ ] `ENFORCE_EXPEDIENTE=true` e relógio fora de 07–17: emissão deve responder 403

## 4. Roteiro de testes manuais

Pré-requisito: ambiente no ar (`ENFORCE_EXPEDIENTE=false` para testar fora do horário). Usuários de desenvolvimento do `npm run seed`: `gestor` e `atendente` (senhas no `.env`).

| ID | Cenário | Passos | Resultado esperado | Regra |
|----|---------|--------|--------------------|-------|
| CT-01 | Emitir senha geral | `/totem` → **Geral** | Número `YYMMDD-SG001` grande; volta à tela inicial após 30 s | RF-001/002 |
| CT-02 | Sequência por tipo | Emitir 2 SG, 1 SP | `SG001`, `SG002`, `SP001` | RN-030 |
| CT-03 | Totem sem dados pessoais | Percorrer o totem | Nenhum campo de texto; aviso de privacidade | LGPD |
| CT-04 | Login inválido | `/login` com senha errada | "Usuário ou senha incorretos." (igual p/ usuário inexistente) | RNF-007 |
| CT-05 | Chamar próxima exige guichê | `/atendente` sem escolher guichê | Botão desabilitado + dica | RN-015 |
| CT-06 | Ordem de prioridade | Emitir `SG, SG, SE, SP, SP, SG`; atender 6 | `SP001, SE001, SP002, SG001, SG002, SG003` | RN-010..014 |
| CT-07 | Painel mostra a chamada | Chamar com o painel aberto | Número + guichê em destaque em ≤ 2 s | RF-017 |
| CT-08 | Painel só 5 últimas | Chamar 7 senhas | Painel lista 5; **não** mostra a próxima | RN-050/051 |
| CT-09 | Áudio | Clicar **Ativar áudio** e chamar | Voz: "Senha geral 3. Guichê 2." | RN-052 |
| CT-10 | Chamar novamente | Chamar → **Chamar novamente** | Painel "Última chamada"; voz "Última chamada. Senha …" | RN-053 |
| CT-11 | Não compareceu só após 2ª chamada | Chamar; verificar botões; chamar novamente | "Não compareceu" só aparece após a 2ª chamada | RN-016 |
| CT-12 | Ciclo completo | Chamar → Iniciar → Finalizar | Estados corretos; cronômetro na fase *em atendimento* | RN-080 |
| CT-13 | Retomar atendimento | Chamar; recarregar a página | Senha continua em atendimento na tela | RF-015 |
| CT-14 | Dois atendentes | Dois navegadores/usuários chamam juntos | Senhas diferentes | RN-040 |
| CT-15 | Atendente sem acesso a gestão | Entrar como atendente; abrir `/gestor/relatorios` | Redireciona para `/atendente`; API devolve 403 | RN-071 |
| CT-16 | Gestor único | Gestor cria segundo gestor | Erro: já existe gestor ativo | RN-070 |
| CT-17 | Desativar usuário | Gestor desativa atendente logado | Próxima ação do atendente volta ao login | RN-072 |
| CT-18 | Relatório diário | Após o CT-06 abrir **Relatórios** | Emitidas 6, atendidas conforme feito, TM por tipo | RN-060 |
| CT-19 | Detalhado em branco | Ver senha não atendida | Atendimento e guichê em branco | RN-061 |
| CT-20 | Auditoria | Aba **Auditoria** | Atendente, guichê, 1ª/2ª chamada, início, fim | RN-062 |
| CT-21 | CSV | **Exportar CSV** e abrir no Excel | Acentos corretos, colunas separadas | RF-030 |
| CT-22 | Painel offline | Parar o backend com o painel aberto | Faixa "Sistema indisponível…", lista mantida | RNF-010 |
| CT-23 | Totem offline | Parar o backend no totem | Botões desabilitados + "Procure a recepção" | RNF-010 |
| CT-24 | Recuperação | Religar o backend | Telas voltam sozinhas em ≤ 15 s | RNF-010 |
| CT-25 | Fora do expediente | `ENFORCE_EXPEDIENTE=true` fora de 07–17 | Totem informa; chamada recusada | RN-020 |
| CT-26 | Descarte | Deixar senhas aguardando após 17h | Viram `DESCARTADA` em ≤ 30 s | RN-021 |
| CT-27 | Teclado | Percorrer totem/atendente só com Tab/Enter | Tudo acionável, foco visível | WCAG 2.1.1 |
| CT-28 | Rate limit | 25 logins errados em 15 min | HTTP 429 | RNF-005 |

## 5. Acessibilidade (pendente)

- [ ] Rodar **axe DevTools** ou **Lighthouse (Accessibility)** em `/totem`, `/painel`, `/login`, `/atendente`, `/gestor/*`
- [ ] Teste com **NVDA** (Windows) ou VoiceOver: totem, painel (anúncio da chamada), atendente
- [ ] Zoom 200% e largura de 320 px
- [ ] Navegação só por teclado (CT-27)

## 6. Testes de desempenho (pendente)

Ferramenta sugerida: `autocannon` (`npx autocannon -c 20 -d 30 -m POST -H "content-type: application/json" -b '{"tipo":"SG"}' http://localhost:3000/api/senhas`). Metas: RNF-030 a RNF-033. Registrar p50/p95/p99 e erros.

## 7. Critério de aceite da entrega

- `npm test` verde no backend e no frontend; `npm run lint` e `npm run build` sem erros;
- seção 3 (MySQL) 100% marcada;
- CT-01 a CT-28 executados, com falhas registradas como *issues* no GitHub;
- itens pendentes (5 e 6) ou executados, ou declarados no README como limitação.
