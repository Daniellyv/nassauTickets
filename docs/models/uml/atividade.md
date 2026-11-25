# Diagrama de atividades — ciclo de atendimento

## Fluxo completo (cliente + atendente + sistema)

```mermaid
flowchart TD
    I([Início]) --> A1[AC toca no tipo de senha no totem]
    A1 --> D1{Expediente<br/>aberto?}
    D1 -- não --> N1[Totem informa fora do expediente] --> F1([Fim])
    D1 -- sim --> A2[AS gera número YYMMDD-PPSQ<br/>e coloca a senha na fila: AGUARDANDO]
    A2 --> A3[AC aguarda e acompanha o painel]
    A3 --> A4[AA aciona Chamar próxima senha]
    A4 --> D2{Há senha<br/>aguardando?}
    D2 -- não --> A4b[Sistema informa fila vazia] --> A4
    D2 -- sim --> A5[AS escolhe o tipo pela regra de priorização<br/>e marca a senha como CHAMADA]
    A5 --> A6[Painel exibe e anuncia a senha e o guichê]
    A6 --> D3{Cliente<br/>compareceu?}
    D3 -- sim --> A7[AA inicia o atendimento: EM_ATENDIMENTO]
    D3 -- não --> A8[AA chama novamente<br/>CHAMADA_NOVAMENTE<br/>painel: Última chamada]
    A8 --> D4{Cliente<br/>compareceu?}
    D4 -- sim --> A7
    D4 -- não --> A9[AA registra Não compareceu<br/>NÃO_COMPARECEU] --> A4
    A7 --> A10[AA finaliza o atendimento: ATENDIDA]
    A10 --> D5{Ainda há<br/>expediente?}
    D5 -- sim --> A4
    D5 -- não --> A11[AS descarta as senhas que sobraram: DESCARTADA]
    A11 --> F2([Fim])
```

## Decisão da próxima senha (`escolherProximoTipo`)

```mermaid
flowchart TD
    S([Última chamada = ultimoTipo]) --> Q1{ultimoTipo<br/>é SP?}
    Q1 -- sim --> O1["Ordem de preferência:<br/>SE, SG, SP"]
    Q1 -- não --> O2["Ordem de preferência:<br/>SP, SE, SG"]
    O1 --> F[Descarta tipos com fila vazia]
    O2 --> F
    F --> Q2{Sobrou algum<br/>tipo?}
    Q2 -- não --> R0([Ninguém a chamar])
    Q2 -- sim --> Q3{Existe tipo diferente<br/>do ultimoTipo?}
    Q3 -- sim --> R1([Chama o primeiro tipo diferente<br/>da lista])
    Q3 -- não --> R2([Chama o único tipo disponível<br/>mesmo repetindo])
```

Exemplos: última = `SP`, filas `SE=1, SG=3, SP=2` → **SE**; última = `SE`, filas `SP=0, SE=4, SG=4` → **SG** (alterna); última = `SG`, filas `SP=0, SE=0, SG=9` → **SG** (única opção).
