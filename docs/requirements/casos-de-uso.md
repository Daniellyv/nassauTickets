# Casos de uso

Atores: **AC** (Agente Cliente, anônimo), **AA** (Agente Atendente), **Gestor** (AA com perfil adicional) e **AS** (Agente Sistema). Diagrama geral em [docs/models/uml/casos-de-uso.md](../models/uml/casos-de-uso.md).

| ID | Caso de uso | Ator principal |
|----|-------------|----------------|
| UC-01 | Retirar senha | AC |
| UC-02 | Acompanhar chamadas no painel | AC |
| UC-03 | Entrar no sistema (login) | AA / Gestor |
| UC-04 | Chamar próxima senha | AA |
| UC-05 | Chamar novamente (última chamada) | AA |
| UC-06 | Iniciar atendimento | AA |
| UC-07 | Finalizar atendimento | AA |
| UC-08 | Registrar não comparecimento | AA |
| UC-09 | Encerrar o expediente (descartar sobras) | AS |
| UC-10 | Gerenciar atendentes | Gestor |
| UC-11 | Gerenciar guichês | Gestor |
| UC-12 | Consultar relatórios | Gestor |
| UC-13 | Consultar auditoria | Gestor |
| UC-14 | Exportar relatório em CSV | Gestor |

---

## UC-01 — Retirar senha

- **Ator:** AC. **Regras:** RN-001, RN-020, RN-030. **Requisitos:** RF-001 a RF-004.
- **Pré-condição:** totem em funcionamento; expediente aberto.
- **Fluxo principal**
  1. O AC toca em **SP**, **SG** ou **SE**.
  2. O AS gera o número `YYMMDD-PPSQ`, grava a senha como `AGUARDANDO` e registra os eventos `EMITIDA` e `AGUARDANDO`.
  3. O totem exibe o número (grande), o tipo, o horário e quantas pessoas já aguardam.
  4. Após 30 s (ou ao tocar em "Retirar outra senha") o totem volta à tela inicial.
- **Fluxos alternativos**
  - *A1 — Fora do expediente:* o AS recusa (403 `fora_do_expediente`); o totem exibe "Fora do expediente de atendimento (07:00 às 17:00)".
  - *A2 — Sistema indisponível:* o botão fica desabilitado e o totem orienta "Procure a recepção" (ver recuperação de desastres).
  - *A3 — Limite diário (999 do tipo):* o AS recusa (409 `limite_diario`).
- **Pós-condição:** senha na fila do seu tipo, sem nenhum dado pessoal associado.

## UC-02 — Acompanhar chamadas no painel

- **Ator:** AC. **Regras:** RN-050 a RN-053. **Requisitos:** RF-017 a RF-020.
- **Fluxo principal**
  1. O painel consulta o AS a cada 2 s.
  2. Exibe a chamada atual em destaque (senha + guichê) e as anteriores, até 5 no total.
  3. Quando surge uma chamada nova, lê em voz alta (se o áudio foi ativado no painel).
- **Alternativos**
  - *A1 — Segunda chamada:* o destaque muda para "Última chamada" e a voz diz "Última chamada. Senha …".
  - *A2 — Backend fora do ar:* mantém a última lista com o aviso "Sistema indisponível — reconectando… Exibindo chamadas de HH:MM".
  - *A3 — Fora do expediente, sem chamadas:* "Atendimento encerrado".
- **Observação:** o navegador só libera áudio após um clique; por isso há o botão **Ativar áudio das chamadas**.

## UC-03 — Entrar no sistema

- **Ator:** AA / Gestor. **Regras:** RN-070, RN-072. **Requisitos:** RF-008.
- **Fluxo principal:** informa usuário e senha → o AS valida (hash) → devolve token → o usuário vai para `/atendente`.
- **Alternativos:** *A1* credenciais inválidas ou usuário inativo → "Usuário ou senha incorretos." (mesma mensagem nos dois casos); *A2* excesso de tentativas (429) → pede para aguardar; *A3* sessão expirada → volta ao login.

## UC-04 — Chamar próxima senha

- **Ator:** AA. **Regras:** RN-010 a RN-015, RN-020, RN-040. **Requisitos:** RF-005 a RF-007, RF-009, RF-010.
- **Pré-condição:** AA logado, guichê escolhido, sem atendimento em aberto, expediente aberto.
- **Fluxo principal**
  1. O AA aciona **Chamar próxima senha**.
  2. O AS, dentro de uma transação com trava, lê a última prioridade chamada e as filas, escolhe o tipo (função `escolherProximoTipo`) e toma a senha mais antiga desse tipo.
  3. A senha vai para `CHAMADA`, com guichê, atendente e horário da 1ª chamada.
  4. O painel passa a exibi-la e a anunciá-la.
- **Alternativos**
  - *A1 — Filas vazias:* o AS responde "Não há senhas aguardando."
  - *A2 — Já tem atendimento em aberto / guichê ocupado:* 409 (`atendimento_em_aberto` / `guiche_ocupado`).
  - *A3 — Concorrência:* AA simultâneos são serializados; cada um recebe uma senha diferente.
- **Pós-condição:** senha em `CHAMADA` atribuída ao AA.

## UC-05 — Chamar novamente

- **Regras:** RN-016, RN-053, RN-041. **Requisitos:** RF-011.
- **Pré-condição:** senha em `CHAMADA` do próprio AA.
- **Fluxo principal:** o AA aciona **Chamar novamente** → a senha vai para `CHAMADA_NOVAMENTE` (2ª chamada) → o painel destaca "Última chamada" e repete o áudio.
- **Alternativos:** *A1* já houve a 2ª chamada → 409 `transicao_invalida`; *A2* senha de outro AA → 403.

## UC-06 — Iniciar atendimento

- **Regras:** RN-080. **Requisitos:** RF-012.
- **Pré-condição:** senha em `CHAMADA` ou `CHAMADA_NOVAMENTE`.
- **Fluxo principal:** o cliente chega ao guichê → o AA aciona **Iniciar atendimento** → `EM_ATENDIMENTO`, com horário de início; a tela mostra um cronômetro.

## UC-07 — Finalizar atendimento

- **Requisitos:** RF-013.
- **Pré-condição:** senha `EM_ATENDIMENTO`.
- **Fluxo principal:** o AA aciona **Finalizar atendimento** → `ATENDIDA`, com horário de fim; o AA e o guichê ficam livres para UC-04.

## UC-08 — Registrar não comparecimento

- **Regras:** RN-016, RN-017. **Requisitos:** RF-014.
- **Pré-condição:** senha em `CHAMADA_NOVAMENTE` (duas chamadas feitas).
- **Fluxo principal:** o cliente não aparece → o AA aciona **Não compareceu** → `NÃO_COMPARECEU` (senha abandonada) → AA e guichê ficam livres.
- **Alternativo:** antes da 2ª chamada a opção não existe na tela e a API rejeita (409).

## UC-09 — Encerrar o expediente

- **Ator:** AS (automático). **Regras:** RN-020, RN-021. **Requisitos:** RF-022.
- **Fluxo principal:** a cada 30 s uma rotina verifica se passaram das 17:00 (ou se há senhas de dias anteriores); as senhas `AGUARDANDO` viram `DESCARTADA`, com evento de auditoria. Atendimentos em curso não são interrompidos.

## UC-10 — Gerenciar atendentes

- **Ator:** Gestor. **Regras:** RN-070 a RN-072. **Requisitos:** RF-023, RF-024.
- **Fluxo principal:** o Gestor abre **Usuários**, preenche nome, login, senha inicial (≥ 8 caracteres) e perfil → o usuário é criado ativo.
- **Outras ações:** ativar/desativar; redefinir senha.
- **Alternativos:** login já existe → 409; tentar criar um segundo gestor → 409 `gestor_unico`; desativar/rebaixar o único gestor → 409 `ultimo_gestor`.

## UC-11 — Gerenciar guichês

- **Ator:** Gestor. **Requisitos:** RF-025.
- **Fluxo principal:** informa o número (1–99) → guichê criado; pode ativar/desativar.
- **Alternativos:** número repetido → 409; desativar guichê em atendimento → 409.

## UC-12 — Consultar relatórios

- **Ator:** Gestor. **Regras:** RN-018, RN-060, RN-061. **Requisitos:** RF-026 a RF-028, RF-031.
- **Fluxo principal:** escolhe **Diário** (data) ou **Mensal** (mês) → o sistema mostra: totais (emitidas, atendidas, não compareceram, descartadas), quantitativos por prioridade, TM geral e por tipo, espera média, taxas, desempenho por atendente e por hora, e a lista detalhada das senhas.
- **Alternativo:** período inválido → mensagem de erro (400).

## UC-13 — Consultar auditoria

- **Regras:** RN-062. **Requisitos:** RF-029.
- **Fluxo principal:** na aba **Auditoria** o Gestor vê, para cada senha chamada: atendente, guichê, senha, situação final, 1ª e 2ª chamada, início e fim.

## UC-14 — Exportar CSV

- **Requisitos:** RF-030.
- **Fluxo principal:** em **Detalhado** ou **Auditoria**, aciona **Exportar CSV** → o navegador baixa um arquivo `;`-separado, UTF-8 com BOM (abre direto no Excel pt-BR).
