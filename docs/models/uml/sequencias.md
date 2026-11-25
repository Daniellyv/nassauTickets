# Diagramas de sequência

## 1. Emitir senha (UC-01)

```mermaid
sequenceDiagram
    actor AC as AC (cliente)
    participant T as Totem (React)
    participant API as API (Express)
    participant S as SenhaService
    participant DB as MySQL

    AC->>T: toca em "Geral"
    T->>API: POST /api/senhas {tipo: "SG"}
    API->>API: valida corpo (zod) e limite de requisições
    API->>S: emitir("SG")
    S->>S: garantirAberto() (07:00–17:00)
    S->>DB: BEGIN + SELECT … FROM fila_estado FOR UPDATE
    S->>DB: upsert sequencias_diarias (data, tipo)
    S->>DB: INSERT senhas (EMITIDA) + evento
    S->>DB: UPDATE senha → AGUARDANDO + evento
    S->>DB: COMMIT
    S-->>API: senha {numero, tipo, aguardandoNaFrente}
    API-->>T: 201 {senha}
    T-->>AC: exibe "SG001" e quantas pessoas aguardam
```

## 2. Chamar a próxima senha com concorrência (UC-04)

Dois atendentes pedem a próxima senha ao mesmo tempo. A trava na linha `fila_estado` serializa as operações: o segundo só lê o estado **depois** que o primeiro confirmou, então recebe outra senha.

```mermaid
sequenceDiagram
    actor A1 as AA 1 (guichê 1)
    actor A2 as AA 2 (guichê 2)
    participant API as API
    participant DB as MySQL

    par chamadas simultâneas
        A1->>API: POST /atendimento/chamar-proxima {guicheId: 1}
        API->>DB: BEGIN + SELECT … fila_estado FOR UPDATE
        Note over API,DB: AA 1 obtém a trava
    and
        A2->>API: POST /atendimento/chamar-proxima {guicheId: 2}
        API->>DB: BEGIN + SELECT … fila_estado FOR UPDATE
        Note over API,DB: AA 2 ESPERA a trava
    end

    API->>DB: (AA 1) lê filas e último tipo
    API->>API: escolherProximoTipo(ultimo, filas) → SP
    API->>DB: (AA 1) senha SP001 → CHAMADA, guichê 1, ultimo_tipo = SP, evento
    API->>DB: (AA 1) COMMIT — libera a trava
    API-->>A1: 200 senha SP001

    Note over API,DB: AA 2 obtém a trava agora
    API->>DB: (AA 2) lê filas (SP001 não está mais AGUARDANDO) e último tipo = SP
    API->>API: escolherProximoTipo(SP, filas) → SE
    API->>DB: (AA 2) senha SE001 → CHAMADA, guichê 2, evento
    API->>DB: (AA 2) COMMIT
    API-->>A2: 200 senha SE001
```

Garantias: nenhuma senha é entregue duas vezes; o ciclo `[SP]→[SE|SG]→…` é respeitado mesmo sob disputa; o mesmo AA ou o mesmo guichê não conseguem abrir dois atendimentos (verificado dentro da transação).

## 3. Chamada, painel e áudio (UC-02, UC-04, UC-05)

```mermaid
sequenceDiagram
    actor AA as AA
    participant Tela as Tela do atendente
    participant API as API
    participant DB as MySQL
    participant P as Painel (React)
    actor AC as AC (cliente)

    AA->>Tela: "Chamar próxima senha"
    Tela->>API: POST /atendimento/chamar-proxima
    API->>DB: senha → CHAMADA (num_chamadas = 1)
    API-->>Tela: senha SG003, guichê 2

    loop a cada 2 s
        P->>API: GET /api/painel
        API->>DB: 5 últimas chamadas do dia
        API-->>P: lista
    end
    P->>P: detecta chamada nova (id + instante)
    P-->>AC: exibe "SG003 — Guichê 2" e fala "Senha geral 3. Guichê 2."

    Note over AC: cliente não comparece
    AA->>Tela: "Chamar novamente"
    Tela->>API: POST /atendimento/{id}/chamar-novamente
    API->>DB: senha → CHAMADA_NOVAMENTE (num_chamadas = 2)
    P->>API: GET /api/painel
    API-->>P: ultimaChamada = true
    P-->>AC: destaque "Última chamada" e voz "Última chamada. Senha geral 3. Guichê 2."

    alt cliente comparece
        AA->>Tela: "Iniciar atendimento"
        Tela->>API: POST /atendimento/{id}/iniciar
        API->>DB: senha → EM_ATENDIMENTO
        AA->>Tela: "Finalizar atendimento"
        Tela->>API: POST /atendimento/{id}/finalizar
        API->>DB: senha → ATENDIDA
    else cliente não comparece
        AA->>Tela: "Não compareceu"
        Tela->>API: POST /atendimento/{id}/nao-compareceu
        API->>DB: senha → NAO_COMPARECEU
    end
```

## 4. Falha do banco (resiliência)

```mermaid
sequenceDiagram
    participant P as Painel
    participant LS as localStorage
    participant API as API
    participant DB as MySQL

    P->>API: GET /api/painel
    API->>DB: consulta
    DB--xAPI: indisponível
    API-->>P: 503 servico_indisponivel
    P->>LS: lê última lista conhecida
    P->>P: mostra a lista + "Sistema indisponível — reconectando…"
    Note over P: intervalo dobra: 2 s, 4 s, 8 s … até 15 s
    P->>API: GET /api/painel
    API->>DB: consulta
    DB-->>API: ok
    API-->>P: 200 lista atual
    P->>LS: grava lista
    P->>P: remove o aviso e volta a 2 s
```
