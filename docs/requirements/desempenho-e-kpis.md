# Proposta para quantificar e acompanhar o desempenho dos atendimentos

Responde ao desafio *"uma proposta para quantificar e acompanhar o desempenho dos atendimentos"*. Os indicadores abaixo **já são calculados** pelo sistema (tela **Relatórios**, aba *Resumo*, e endpoints `/api/relatorios/diario` e `/api/relatorios/mensal`).

## Indicadores

| Indicador | Fórmula | Fonte | Para que serve |
|-----------|---------|-------|----------------|
| **TM** — tempo médio de atendimento (geral e por tipo) | média de `fim_atendimento − inicio_atendimento` das senhas `ATENDIDA` | `senhas` | Comparar com o esperado (SG ≈ 5 min, SP ≈ 15 min, SE ≈ 1–2 min) e detectar atendimentos anormalmente longos |
| **Espera média** | média de `primeira_chamada − emissão` das senhas chamadas | `senhas` | Principal medida de **experiência do cliente** |
| **Taxa de atendimento** | atendidas ÷ emitidas | `senhas` | Capacidade de entregar o serviço no expediente |
| **Taxa de não comparecimento** | `NÃO_COMPARECEU` ÷ emitidas | `senhas` | Comparar com o histórico (~5%) |
| **Senhas descartadas** | `DESCARTADA` no fim do expediente | `senhas` | **Sinal de sub-dimensionamento:** sobrou fila às 17h |
| **Vazão por atendente** | atendidas por atendente (e TM de cada um) | `senhas` + `usuarios` | Distribuição de carga (uso de apoio à gestão, não de punição) |
| **Vazão por hora** | atendidas por hora do dia | `senhas` | Identificar horários de pico para escalar guichês |
| **Série por dia** (relatório mensal) | emitidas e atendidas por data | `senhas` | Tendência e sazonalidade |

## Como acompanhar (rotina proposta)

1. **Diário (Gestor, fim do expediente):** abrir o relatório do dia; observar *descartadas*, *espera média* e *taxa de não comparecimento*.
2. **Semanal:** comparar a *vazão por hora* dos dias da semana para ajustar a escala de atendentes.
3. **Mensal:** usar o relatório mensal (série por dia, TM por tipo) para revisar metas e dimensionamento.
4. **Auditoria sob demanda:** o relatório de auditoria permite investigar um atendimento específico (quem, onde, quando, quantas chamadas).

### Metas sugeridas (a definir com o laboratório)

| Indicador | Meta inicial sugerida | Alerta |
|-----------|-----------------------|--------|
| Espera média | ≤ 10 min | > 15 min |
| Senhas descartadas por dia | 0 | ≥ 1 |
| Taxa de não comparecimento | ≈ 5% (histórico) | > 10% |
| TM da SG | 5 min ± 3 | média > 8 min |

São valores de partida para discussão, não requisitos do enunciado.

## Dimensionamento: quantos guichês?

Carga de trabalho (em guichês ocupados) ≈ **chegadas por minuto × TM médio ponderado**. Com a mistura do enunciado usada na simulação (SG 55%, SE 25%, SP 20%):

```
TM ponderado = 0,55 × 5 + 0,25 × 1,2 + 0,20 × 15 ≈ 6,05 min
chegadas = 0,3 senhas/min  →  carga ≈ 0,3 × 6,05 ≈ 1,8 guichês
```

Com carga de 1,8, **2 guichês operam a ~90% de utilização ou mais** (sem contar o tempo de deslocamento do cliente e de espera por não comparecimento) e saturam na prática; 3 guichês ficam em ~60%.

## Evidência: simulação de um dia

`npm run simulate -- --guiches=N --seed=7` simula 07:00–17:00 usando os **serviços reais** do sistema com relógio virtual (SG 5±3 min, SP 15±5 min, SE 1 min/5 min 95%/5%, 5% de não comparecimento). Resultados (0,3 senhas/min, ~190 senhas no dia):

| Guichês | Emitidas | Atendidas | Não compareceram | Descartadas | Espera média | TM geral |
|:-------:|:--------:|:---------:|:----------------:|:-----------:|:------------:|:--------:|
| 2 | 194 | 139 | 4 | **51** | **70 min 41 s** | 7 min 03 s |
| 3 | 188 | 178 | 9 | 1 | 4 min 36 s | 6 min 33 s |
| 4 | 187 | 178 | 9 | 0 | 1 min 12 s | 6 min 33 s |

TM por tipo com 3 guichês: SP 14 min 32 s · SE 1 min 07 s · SG 4 min 56 s — coerentes com as estatísticas históricas. A taxa de não comparecimento simulada (4,8%) reproduz o ~5% do histórico.

Leituras:

- Com **2 guichês** o sistema satura: a fila cresce o dia todo, a espera passa de 1 h e 51 senhas são descartadas às 17h.
- **3 guichês** atendem a demanda com espera média de ~5 min.
- **4 guichês** dão folga, com espera de ~1 min, ao custo de mais ociosidade.

> Observações de método: as simulações usam a mesma semente, mas o número de emissões varia levemente entre elas (194/188/187) porque o consumo do gerador pseudoaleatório depende do estado do atendimento. É uma ilustração, não uma previsão estatística (uma execução por cenário, sem intervalos de confiança). Para conclusões mais firmes, rodar `--dias=20` e comparar médias.

## Evoluções possíveis

- Painel de acompanhamento em tempo real para o Gestor (fila por tipo, tempo da senha mais antiga).
- Alertas automáticos quando espera média ou fila ultrapassarem limites.
- Previsão de espera exibida no totem (com base no TM medido e na fila atual).
- Pesquisa rápida de satisfação ao final do atendimento (exigiria nova análise de LGPD).
