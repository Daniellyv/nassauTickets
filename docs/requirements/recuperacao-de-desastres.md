# Recuperação de desastres e resiliência

Responde ao desafio: *"caso o backend ou o banco de dados falhe, o que o frontend e o painel deverão exibir ou como deverão se comportar"*.

## Princípios

1. **Nunca mostrar tela quebrada**: toda falha de disponibilidade vira um aviso claro em português.
2. **Preferir dado conhecido a tela vazia**, informando até quando o dado é confiável.
3. **Não inventar estado**: nenhuma tela emite, chama ou conclui nada "no escuro". Operações que mudam a fila só valem quando o servidor confirma.
4. **Recuperar sozinho**: as telas voltam ao normal sem recarregar quando o serviço volta.

## Como a falha é detectada

| Situação | O que o backend responde | O que o frontend entende |
|----------|--------------------------|--------------------------|
| Backend fora do ar / sem rede / tempo esgotado (4–8 s) | — (sem resposta) | `ErroApi` status 0 → **indisponível** |
| Backend no ar, **banco fora** | **503** `servico_indisponivel` (erros de conexão do MySQL são convertidos) | status ≥ 500 → **indisponível** |
| `GET /api/health` | 200 `{status:"ok"}` ou 503 `{status:"degradado", banco:"indisponivel"}` | sonda usada pelo totem a cada 5 s |
| Erro de regra (400/403/404/409) | JSON com `erro` e `mensagem` | **não** é indisponibilidade: mostra a mensagem da regra |

Falhas de rede e 5xx são tratadas como "indisponível"; erros 4xx nunca disparam o aviso de queda.

## Comportamento por tela

| Tela | Durante a falha | Ao voltar |
|------|-----------------|-----------|
| **Painel** (`/painel`) | Mantém a **última lista de chamadas** (guardada no `localStorage`, que também sobrevive a recarregar a página). Exibe faixa: *"Sistema indisponível — reconectando… Exibindo chamadas de HH:MM"*. Não toca áudio de chamadas antigas. | Atualiza sozinho em até 2 s, remove a faixa e volta a anunciar novas chamadas. |
| **Totem** (`/totem`) | Os botões ficam **desabilitados** e o totem exibe *"Totem temporariamente indisponível. Procure a recepção."* Se a falha ocorrer no instante do toque: *"Sistema indisponível. Procure a recepção."* — nenhuma senha é "fingida". | Reabilita os botões na próxima sondagem (≤ 5 s). |
| **Atendente** (`/atendente`) | Faixa de indisponibilidade na fila; os botões de ação mostram o erro se acionados (a operação não é aplicada). A senha em atendimento continua visível na tela. | Fila volta a atualizar; se houver divergência, a tela **ressincroniza** com `GET /api/atendimento/atual`. |
| **Gestor** (relatórios/cadastros) | Mensagem de erro no local da ação; dados já carregados permanecem. | Basta repetir a ação. |
| **Login** | *"Sistema indisponível no momento. Tente novamente em instantes."* | — |

### Estratégia de nova tentativa (*backoff*)

As consultas periódicas (painel 2 s; fila e saúde 3–5 s) dobram o intervalo a cada falha consecutiva até **15 s**, para não sobrecarregar um servidor que está se recuperando, e voltam ao intervalo normal na primeira resposta bem-sucedida. Implementado em `frontend/src/hooks/usePolling.js` e coberto por teste automatizado (falha → intervalo dobra → recuperação).

## Cenários de desastre e procedimentos

| Cenário | Efeito | Procedimento de recuperação | Meta (proposta) |
|---------|--------|-----------------------------|-----------------|
| **Processo do backend caiu** | Telas em modo indisponível (acima) | Reiniciar o serviço (`npm start`; em produção, gerenciador de processos com *restart* automático). Nada se perde: o estado está no banco. | RTO ≤ 5 min |
| **MySQL indisponível** | Backend responde 503 | Reiniciar o MySQL/contêiner (`docker compose up -d`). O *pool* reconecta sozinho nas próximas requisições. | RTO ≤ 15 min |
| **Queda no meio de uma operação** | A transação sofre *rollback*: a senha **não** fica "meio chamada" | Repetir a operação na tela. | — |
| **Perda de dados do banco** | Perda de histórico | Restaurar o último backup (`mysqldump`/volume). **Backup diário é recomendação de implantação** (não automatizado pelo projeto). | RPO ≤ 24 h |
| **Falta de energia / rede no laboratório** | Totem e painel sem comunicação | Contingência manual: senhas de papel numeradas por tipo; ao retornar, o AS continua a sequência do dia a partir do banco (reconciliar manualmente se necessário). | — |
| **Virada de dia com a fila cheia / servidor desligado às 17h** | Senhas `AGUARDANDO` de dias anteriores | A rotina de expediente descarta senhas de dias anteriores ao subir (RN-021). | — |

## O que ainda não existe (declarado)

- Alta disponibilidade do banco (réplica/cluster) e *failover* automático.
- Backup automatizado e teste periódico de restauração.
- Monitoramento/alertas externos (a sonda `/api/health` está pronta para ser consumida por uma ferramenta).
- Fila local no totem para emitir senha **sem** servidor (descartada de propósito: geraria números duplicados e quebraria a regra de sequência única — RN-031).
