# Regras de negócio

Cada regra tem um identificador (RN-xxx) citado nos requisitos, no código e nos testes.

## Senhas e guichês

| ID | Regra |
|----|-------|
| RN-001 | Existem três tipos de senha: **SP** (prioritária), **SG** (geral) e **SE** (retirada de exames). |
| RN-002 | Não há guichê dedicado: qualquer guichê atende qualquer tipo de senha. |

## Priorização da fila

A cada novo atendimento deve ser chamada uma senha de prioridade **diferente** da anterior, segundo o ciclo do enunciado:

```
[SP] -> [SE|SG] -> [SP] -> [SE|SG] -> ...
```

| ID | Regra |
|----|-------|
| RN-010 | A senha SP tem a maior prioridade. A cada atendimento, se a vez é da SP e há SP aguardando, ela é chamada. No início do dia a vez é da SP. |
| RN-011 | Depois de uma SP, a vez é "não prioritária": a **SE** é chamada antes da **SG** (a SE tem prioridade operacional especial e atendimento muito rápido). |
| RN-012 | Nunca se repete o tipo da última chamada quando existe alternativa. Consequência: sem SP na fila, **SE e SG se alternam**. |
| RN-013 | Se a fila do tipo da vez está vazia, o sistema segue a ordem de prioridade (SP > SE > SG) com o que houver. Se todas estão vazias, ninguém é chamado. |
| RN-014 | Dentro do mesmo tipo vale a ordem de chegada (FIFO). |

> **Premissa registrada.** O enunciado descreve o ciclo de duas formas (diagrama `[SP]→[SE|SG]→[SP]` e texto "SP, depois SE, por fim SG"). Adotamos a leitura do diagrama (SP em dias alternados do ciclo), com SE antes de SG na vaga não prioritária. Efeito colateral aceito: com SP **e** SE chegando continuamente, a SG pode esperar mais. A RN-012 atenua isso quando não há SP. Se o laboratório preferir outra leitura, só a função `escolherProximoTipo` ([`backend/src/domain/prioridade.js`](../../backend/src/domain/prioridade.js)) muda.

Exemplo — chegadas `SG, SG, SE, SP, SP, SG`, um guichê:

| Chamada | Última | Escolhida | Motivo |
|:-------:|:------:|:---------:|--------|
| 1 | — | SP001 | RN-010 |
| 2 | SP | SE001 | RN-011 |
| 3 | SE | SP002 | vez da SP |
| 4 | SP | SG001 | sem SE (RN-013) |
| 5 | SG | SG002 | só há SG |
| 6 | SG | SG003 | só há SG |

## Atendimento

| ID | Regra |
|----|-------|
| RN-015 | Um AA só chama nova senha quando **não tem** atendimento em aberto (CHAMADA, CHAMADA_NOVAMENTE ou EM_ATENDIMENTO) e o guichê escolhido não está ocupado. |
| RN-016 | Cada senha admite **duas chamadas**. Se o cliente não comparecer após a segunda, a senha vai para `NÃO_COMPARECEU` (abandonada) e o AS passa à próxima. A marcação só é permitida depois da 2ª chamada. |
| RN-017 | Historicamente, ~5% das senhas emitidas não são atendidas por responsabilidade do cliente. É uma **estatística**, não uma regra executada: o sistema apenas registra o não comparecimento quando ocorre. O simulador usa os 5% para gerar dados. |
| RN-018 | **TM** (tempo médio de atendimento) é a média de `fim − início` das senhas `ATENDIDA`. Valores históricos usados na simulação: SG = 5 min ± 3 (uniforme); SP = 15 min ± 5 (uniforme); SE = 1 min em 95% e 5 min em 5%. O relatório mostra o TM **medido**, que varia. |

## Expediente

| ID | Regra |
|----|-------|
| RN-020 | O expediente vai das **07:00 às 17:00** (fuso `America/Recife`). Fora dele não se emitem nem se chamam senhas. |
| RN-021 | Às 17:00, as senhas ainda `AGUARDANDO` são **descartadas** (`DESCARTADA`). Senhas de dias anteriores esquecidas na fila também. Atendimentos já em curso podem ser concluídos pelo AA. |

## Numeração

| ID | Regra |
|----|-------|
| RN-030 | Formato `YYMMDD-PPSQ`: ano, mês, dia da emissão; `PP` = tipo; `SQ` = sequência de **3 dígitos por tipo**, reiniciada todo dia. Ex.: `260325-SP001`. Limite de 999 senhas por tipo por dia. |
| RN-031 | O número da senha é único e nunca é reutilizado. |

## Concorrência e propriedade

| ID | Regra |
|----|-------|
| RN-040 | Chamadas simultâneas de AA diferentes são **serializadas** pelo banco (trava na linha `fila_estado`): cada AA recebe uma senha diferente e nenhuma senha é chamada duas vezes. O mesmo vale para a numeração. |
| RN-041 | Somente o AA que chamou a senha pode chamá-la novamente, iniciá-la, finalizá-la ou marcá-la como não compareceu. |

## Painel e áudio

| ID | Regra |
|----|-------|
| RN-050 | O painel exibe as **5 últimas** senhas chamadas (do dia), com o guichê. |
| RN-051 | O painel **não** exibe a próxima senha: entre o fim de um atendimento e a próxima chamada pode entrar uma SP e mudar a sequência. |
| RN-052 | A chamada é lida em voz alta: tipo (prioritária/geral/exames), sequencial e guichê. Ex.: "Senha prioritária 3. Guichê 2." |
| RN-053 | "Chamar Novamente" repete a chamada precedida de "Última chamada." e só pode ser usada uma vez por senha (é a 2ª chamada). |

## Relatórios

| ID | Regra |
|----|-------|
| RN-060 | Relatórios diário e mensal trazem emitidas e atendidas (geral e por prioridade), não comparecimentos, descartadas e TM. O período é pela **data de emissão** da senha. |
| RN-061 | No detalhado, senhas não atendidas têm data/hora de atendimento e guichê **em branco**. |
| RN-062 | A auditoria lista, para cada senha chamada: atendente, guichê, senha, 1ª e 2ª chamada, início e fim. |

## Acesso

| ID | Regra |
|----|-------|
| RN-070 | Só o AA usa login. O AC é anônimo e interage apenas com o totem. Existe **um único gestor ativo**, que também atende. |
| RN-071 | Somente o Gestor cadastra atendentes e guichês e consulta relatórios. |
| RN-072 | Desativar um usuário revoga o acesso **imediatamente** (o token é revalidado a cada requisição). Não é possível desativar ou rebaixar o único gestor. |

## Máquina de estados

| ID | Regra |
|----|-------|
| RN-080 | Transições permitidas (qualquer outra é rejeitada com HTTP 409): |

| De | Para |
|----|------|
| EMITIDA | AGUARDANDO |
| AGUARDANDO | CHAMADA, DESCARTADA |
| CHAMADA | CHAMADA_NOVAMENTE, EM_ATENDIMENTO |
| CHAMADA_NOVAMENTE | EM_ATENDIMENTO, NAO_COMPARECEU |
| EM_ATENDIMENTO | ATENDIDA |
| ATENDIDA, NAO_COMPARECEU, DESCARTADA | — (finais) |

Notas: `CHAMADA → EM_ATENDIMENTO` cobre o caso comum (cliente comparece na 1ª chamada). `DESCARTADA` é uma **extensão** dos sete estados do enunciado, necessária para representar a regra de descarte do fim do expediente. Em tela e relatórios o estado aparece como **NÃO_COMPARECEU** (com acento); no banco e na API é `NAO_COMPARECEU`.
