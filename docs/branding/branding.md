# Identidade visual — nassauTickets

## Conceito

O nome combina **Nassau** (referência à instituição) com **Tickets** (senhas). O símbolo é uma **senha de papel com um sinal de "+"** (cruz, remetendo à saúde) em azul-petróleo. Tom de voz: **claro, acolhedor e direto**, em português do Brasil, frases curtas, sem jargão técnico no que o cliente lê.

Arquivo do logotipo: [`logo.svg`](logo.svg) (mesmo desenho do ícone da aplicação em `frontend/public/favicon.svg`).

## Paleta

Os valores abaixo são exatamente os usados em [`frontend/src/styles/global.css`](../../frontend/src/styles/global.css). Razões de contraste **calculadas** pela fórmula da WCAG 2.1.

### Interface

| Token | Cor | Uso | Contraste (par) |
|-------|-----|-----|-----------------|
| `--cor-primaria` | `#0f5c7a` | Cabeçalho, botões primários | **7,4 : 1** com branco |
| `--cor-primaria-escura` | `#0a4259` | Hover | 10,8 : 1 com branco |
| `--cor-fundo` | `#f4f7f9` | Fundo da página | — |
| `--cor-texto` | `#14212b` | Texto | 15,2 : 1 sobre o fundo |
| `--cor-texto-suave` | `#4a5a67` | Texto secundário | 7,1 : 1 sobre branco · 6,6 : 1 sobre o fundo |
| `--cor-erro` | `#a4161a` | Erros | 7,8 : 1 sobre branco |
| `--cor-sucesso` | `#1b5e20` | Confirmações | 7,9 : 1 sobre branco |
| `--cor-info` | `#0b4f8a` | Informações | 8,4 : 1 sobre branco |
| alerta | `#5c4400` sobre `#fff3cd` | Faixa de indisponibilidade | 8,3 : 1 |

### Tipos de senha

A cor **nunca** é o único identificador: sempre acompanha a sigla (SP/SG/SE) e o nome.

| Tipo | Cor | Contraste com texto branco |
|------|-----|---------------------------|
| **SP** — Prioritária | `#a4161a` (vermelho) | 7,8 : 1 |
| **SE** — Retirada de Exames | `#5b2a86` (roxo) | 9,9 : 1 |
| **SG** — Geral | `#1b5e20` (verde) | 7,9 : 1 |

### Painel de chamadas (tema escuro, para TV)

| Elemento | Cor | Contraste |
|----------|-----|-----------|
| Texto sobre fundo `#0b1620` | `#ffffff` | 18,3 : 1 |
| Rótulo "Chamando" sobre `#12304a` | `#ffd98a` | 10,0 : 1 |
| Moldura de destaque sobre o fundo | `#ffbf47` | 11,1 : 1 |
| Texto secundário sobre `#102233` | `#c9d6df` | 10,9 : 1 |

### Foco do teclado

Anel de **3 px âmbar (`#ffbf47`)** com sombra externa escura (`#14212b`). O âmbar sozinho tem apenas 1,6 : 1 sobre branco; a sombra escura (15 : 1) é que garante a visibilidade do foco em qualquer fundo.

## Tipografia

Pilha de fontes do sistema (sem download de fontes, carregamento rápido e boa legibilidade):

```
'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif
```

| Contexto | Tamanho |
|----------|---------|
| Texto corrente | 1 rem (16 px) |
| Títulos de tela | 1,75 rem |
| Número da senha (atendente) | 3,5 rem |
| Totem — botões | sigla 4 rem, nome 1,75 rem |
| Totem — número emitido | 7 rem |
| Painel — número chamado | até 12 rem (`clamp(5rem, 16vw, 12rem)`) |

## Forma e espaçamento

- Raio de borda: 10 px (cartões e botões), 20–24 px no totem e no painel.
- Alvo de toque mínimo: **44 px**; botões do totem com mais de 15 rem de altura.
- Sombra única e discreta nos cartões.

## Boas práticas de uso

- Use o logotipo sobre fundo claro ou sobre `#0f5c7a`; não distorça nem altere as cores.
- Não use as cores dos tipos de senha para outros fins (evita confusão no totem e no painel).
- Mensagens ao cliente: voz ativa e instrução clara ("Procure a recepção", "Aguarde ser chamado no painel").
