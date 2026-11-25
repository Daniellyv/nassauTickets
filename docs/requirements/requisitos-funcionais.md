# Requisitos funcionais

Sistema **nassauTickets** — Controle de Atendimento de um Laboratório de Análises Clínicas (aplicação **Web**).

Base: documento *Sistema para controle de atendimento* (v06) e *Atividade — Projeto nassauTickets*.

## Agentes

| Sigla | Agente | Papel | Interface |
|-------|--------|-------|-----------|
| **AS** | Agente Sistema | Executa as regras, persiste dados, emite senhas, atualiza o painel e responde aos comandos de AA e AC | API REST (Node.js/Express) + MySQL |
| **AA** | Agente Atendente | Chama o próximo cliente e realiza o atendimento no guichê. Um único AA tem também o perfil **Gestor** (cadastros e relatórios) | Tela `/atendente` e `/gestor/*` (login) |
| **AC** | Agente Cliente | Retira a senha no totem e aguarda ser chamado no painel. **Anônimo** | Telas `/totem` e `/painel` (sem login) |

## Tipos de senha

| Sigla | Nome | Prioridade |
|-------|------|------------|
| **SP** | Senha Prioritária | Maior |
| **SE** | Senha para retirada de Exames | Operacional especial (após SP) |
| **SG** | Senha Geral | Menor |

## Lista de requisitos

Prioridade: **E** = essencial (exigido pelo enunciado) · **D** = desejável (desafio/valor agregado).

### Emissão de senhas (totem)

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-001 | O AC deve poder retirar uma senha SP, SG ou SE no totem, **sem se identificar**. | E | RN-001, RN-070 |
| RF-002 | O AS deve numerar cada senha no padrão `YYMMDD-PPSQ`, com sequência por tipo e reinício diário. | E | RN-030, RN-031 |
| RF-003 | Após a emissão, o totem deve exibir o número, o tipo, o horário e quantas pessoas já aguardam, e voltar sozinho à tela inicial. | E | — |
| RF-004 | O AS não deve emitir senhas fora do expediente (07:00–17:00) e deve informar o motivo ao cliente. | E | RN-020 |

### Fila e priorização

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-005 | O AS deve manter uma fila por tipo de senha e escolher a próxima conforme o ciclo `[SP] → [SE\|SG] → [SP] → …`. | E | RN-010 a RN-014 |
| RF-006 | Qualquer guichê deve poder atender qualquer tipo de senha. | E | RN-002 |
| RF-007 | Dois ou mais AA que pedem a próxima senha quase ao mesmo tempo devem receber senhas **diferentes**, sem duplicidade nem perda. | E | RN-040 |

### Atendimento (AA)

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-008 | O AA deve entrar no sistema com usuário e senha. | E | RN-070 |
| RF-009 | O AA deve escolher o guichê em que está atendendo. | E | RN-015 |
| RF-010 | O AA deve **chamar a próxima senha**; o painel deve exibi-la com o guichê. | E | RN-010, RN-015 |
| RF-011 | O AA deve poder **chamar novamente** uma senha (última chamada), repetindo o áudio precedido de "Última chamada". | E | RN-016, RN-053 |
| RF-012 | O AA deve **iniciar** o atendimento quando o cliente chegar ao guichê. | E | RN-080 |
| RF-013 | O AA deve **finalizar** o atendimento. | E | RN-080 |
| RF-014 | Após duas chamadas sem comparecimento, o AA deve registrar **não compareceu** e o AS deve liberar o guichê para a próxima senha. | E | RN-016 |
| RF-015 | Ao recarregar a tela, o AA deve retomar o atendimento que estava em aberto. | D | RN-015 |
| RF-016 | Um AA não pode agir sobre a senha de outro AA. | E | RN-041 |

### Painel de chamadas

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-017 | O painel deve exibir as **5 últimas** senhas chamadas, com o guichê, e **nunca** a próxima senha. | E | RN-050, RN-051 |
| RF-018 | A cada chamada o painel deve emitir **áudio** informando prioridade, sequencial da senha e guichê. | D | RN-052 |
| RF-019 | Em "Chamar Novamente" o áudio deve ser repetido precedido por "Última chamada", e o painel deve destacar essa condição. | D | RN-053 |
| RF-020 | O painel deve atualizar-se automaticamente, sem ação humana. | E | — |

### Máquina de estados

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-021 | Cada senha deve percorrer os estados `EMITIDA → AGUARDANDO → CHAMADA → CHAMADA_NOVAMENTE → EM_ATENDIMENTO → ATENDIDA`, podendo terminar em `NÃO_COMPARECEU`. Transições inválidas devem ser rejeitadas. | E | RN-080 |
| RF-022 | Ao fim do expediente, senhas que permanecerem na fila devem ser descartadas (estado `DESCARTADA`); atendimentos em curso podem ser concluídos. | E | RN-021 |

### Gestão (perfil Gestor)

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-023 | O Gestor deve cadastrar, ativar/desativar atendentes e redefinir suas senhas. | E | RN-071, RN-072 |
| RF-024 | O sistema deve admitir **um único gestor ativo**. | E | RN-070 |
| RF-025 | O Gestor deve cadastrar e ativar/desativar guichês. | E | RN-071 |

### Relatórios e auditoria (Gestor)

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-026 | Relatórios **diário** e **mensal** com: senhas emitidas e atendidas (geral e por prioridade). | E | RN-060 |
| RF-027 | Relatório **detalhado**: número, tipo, data/hora de emissão, data/hora de atendimento e guichê; campos de atendimento em branco para senhas não atendidas. | E | RN-061 |
| RF-028 | Relatório do **Tempo Médio de atendimento (TM)**, geral e por tipo. | E | RN-018, RN-060 |
| RF-029 | Relatório de **auditoria**: atendente, guichê, senha, 1ª chamada, 2ª chamada (se houver), início e fim do atendimento. | E | RN-062 |
| RF-030 | Exportação dos relatórios detalhado e de auditoria em **CSV**. | D | — |
| RF-031 | **Proposta de desempenho:** indicadores de taxa de atendimento, taxa de não comparecimento, espera média, vazão por atendente e por hora. | D | ver `desempenho-e-kpis.md` |
| RF-032 | **Simulador** de um dia de atendimento com as estatísticas históricas do enunciado, para demonstração e validação. | D | RN-017, RN-018 |

### Resiliência

| ID | Requisito | Prior. | Regras |
|----|-----------|:------:|--------|
| RF-033 | Se o backend ou o banco falharem, o painel deve manter a última lista conhecida com aviso, o totem deve orientar o cliente e as telas devem reconectar sozinhas. | D | ver `recuperacao-de-desastres.md` |

## Fora do escopo

- Aplicativo mobile (decisão do grupo: somente aplicação Web).
- Integração com outros sistemas do laboratório (laudos, agendamento).
- Impressão física de senha (a senha é exibida na tela do totem).
