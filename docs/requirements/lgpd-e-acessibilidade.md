# LGPD e acessibilidade

> Este documento é uma proposta técnica elaborada pelo grupo. Pontos jurídicos (base legal, prazos de retenção) devem ser **validados com o encarregado de dados (DPO) / jurídico** do laboratório antes da implantação.

## 1. LGPD — Lei nº 13.709/2018

### 1.1 Dados tratados

| Titular | Dados | Finalidade | Observação |
|---------|-------|------------|------------|
| **Cliente (AC)** | **Nenhum dado pessoal.** O totem não pede nome, CPF, telefone etc. A senha é apenas `tipo + número`. | Ordenar o atendimento | O AC é anônimo (RN-070) |
| **Atendente / Gestor** | nome, login, hash da senha, perfil, situação | Controle de acesso e auditoria das ações | dados de colaboradores |
| **Operação** | tipo e número da senha, horários, guichê, atendente | Relatórios, auditoria, desempenho | sem vínculo com pessoa identificada |

### 1.2 Atenção: o tipo da senha pode revelar condição do cliente

Uma senha **SP** (prioritária) indica, indiretamente, idade, gestação ou deficiência, e **SE** indica que o cliente fez exames. Por isso o sistema:

- **nunca associa a senha a uma pessoa identificada** (sem nome/CPF em nenhum ponto do fluxo);
- não registra câmera, biometria, IP ou dispositivo do totem;
- exibe no painel somente `tipo+sequencial` e guichê (ex.: `SP003 — Guichê 2`).

> Se no futuro o laboratório quiser vincular a senha a um cadastro (nome, CPF, convênio), o tratamento passa a envolver possíveis **dados pessoais sensíveis de saúde** (art. 11) e exige nova análise de base legal, relatório de impacto (RIPD) e consentimento ou hipótese equivalente.

### 1.3 Princípios aplicados (art. 6º)

| Princípio | Como é atendido |
|-----------|-----------------|
| Finalidade e adequação | Dados usados apenas para gerir filas, relatórios e auditoria |
| Necessidade (minimização) | Cliente anônimo; colaborador com o mínimo (nome, login, perfil) |
| Livre acesso / transparência | Aviso no totem: "Nenhum dado pessoal é solicitado ou armazenado"; colaboradores podem consultar seus dados com o Gestor |
| Segurança e prevenção | Hash de senhas, controle de acesso por perfil, rate limit, validação de entrada, logs de auditoria (ver [requisitos-nao-funcionais.md](requisitos-nao-funcionais.md)) |
| Responsabilização | Trilha de auditoria somente-inserção (`eventos_senha`) |

### 1.4 Bases legais sugeridas (a validar)

- **Colaboradores:** execução de contrato / cumprimento de obrigação e exercício regular de direitos (art. 7º, II, V e VI) e legítimo interesse para segurança e auditoria (art. 7º, IX).
- **Clientes:** não há tratamento de dado pessoal; a base legal não se aplica enquanto o anonimato for preservado.

### 1.5 Retenção e descarte (proposta)

| Dado | Retenção sugerida | Ação |
|------|-------------------|------|
| Senhas e eventos (operacionais, anônimos) | 12 meses detalhados | depois, manter apenas agregados mensais |
| Usuários desativados | enquanto houver necessidade de auditoria do período trabalhado | anonimizar nome/login ao final |
| Logs de aplicação | 6 meses (Marco Civil da Internet, art. 15, aplica-se a provedores de aplicações) | rotação |

> O projeto **ainda não automatiza** a retenção/descarte; está listado como evolução. O banco usa apenas inserção em `eventos_senha`; senhas antigas podem ser arquivadas por rotina administrativa.

### 1.6 Direitos do titular (art. 18)

Aplicam-se aos colaboradores: confirmação de tratamento, acesso, correção (feita pelo Gestor em **Usuários**), eliminação/anonimização quando cabível e informação sobre compartilhamento (não há compartilhamento com terceiros).

### 1.7 Incidentes

Em caso de incidente de segurança com dados pessoais, o laboratório deve comunicar a ANPD e os titulares conforme art. 48. O sistema ajuda com a trilha de auditoria e o registro de acessos autenticados.

---

## 2. Acessibilidade

### 2.1 Referências

- **WCAG 2.1, nível AA** (padrão adotado);
- **Lei nº 13.146/2015 (Lei Brasileira de Inclusão)**, art. 63 — acessibilidade em sítios da internet;
- **Decreto nº 5.296/2004** e **Lei nº 10.098/2000** — acessibilidade e atendimento a pessoas com deficiência;
- **Lei nº 10.048/2000** — prioridade de atendimento (origem da senha SP);
- **eMAG** (Modelo de Acessibilidade em Governo Eletrônico), como boa prática complementar.

### 2.2 Checklist e situação

Situação: ✅ implementado e verificado no código/testes · 🟡 implementado, **sem auditoria formal** · ⏳ pendente.

| Critério WCAG | Medida no projeto | Situação |
|---------------|-------------------|:--------:|
| 1.1.1 Conteúdo não textual | Imagens decorativas com `alt=""`; ícones `aria-hidden`; texto alternativo onde há significado | ✅ |
| 1.3.1 Informação e relações | Marcos semânticos (`header`, `nav`, `main`), títulos hierárquicos, `label` em todos os campos, tabelas com `caption` e `th scope` | ✅ |
| 1.3.5 Finalidade do campo | `autocomplete` (`username`, `current-password`, `new-password`) | ✅ |
| 1.4.1 Uso de cor | Tipo de senha sempre com **sigla + nome + cor** (nunca só cor) | ✅ |
| 1.4.3 Contraste mínimo (4,5:1) | Todos os pares de texto da paleta ≥ 6,6:1 (calculado; ver [branding](../branding/branding.md)) | ✅ |
| 1.4.4 Redimensionar texto | Unidades relativas (`rem`), layout fluido | 🟡 |
| 1.4.10 Reflow | Grades responsivas (`auto-fit`, quebra em 760 px) | 🟡 |
| 1.4.11 Contraste de não texto | Foco com anel duplo (escuro + âmbar); campos com borda de 2 px a 7:1 | ✅ |
| 2.1.1 Teclado | Todos os controles são `button`, `a`, `input`, `select` nativos; tabelas roláveis focáveis | ✅ |
| 2.2.1 Ajuste de tempo | Senha permanece 30 s no totem e há botão para continuar | ✅ |
| 2.2.2 Pausar, parar, ocultar | A única animação (pulso do painel) roda uma vez e é desligada por `prefers-reduced-motion` | ✅ |
| 2.4.1 Ignorar blocos | Link "Pular para o conteúdo" nas telas internas | ✅ |
| 2.4.2 Título da página | `<title>` do documento | 🟡 (título único; evoluir para um por rota) |
| 2.4.7 Foco visível | `:focus-visible` com anel de 3 px + sombra escura | ✅ |
| 2.5.5 Tamanho do alvo | Botões ≥ 44 px; totem com botões de ≥ 15 rem | ✅ |
| 3.1.1 Idioma | `<html lang="pt-BR">` | ✅ |
| 3.3.1/3.3.3 Identificação e sugestão de erros | Mensagens em texto claro, `role="alert"`, ligadas à ação | ✅ |
| 4.1.2 Nome, função, valor | Abas com `role="tablist/tab/tabpanel"` e `aria-selected`; botões com nome acessível (incl. texto `sr-only` nas ações de tabela) | ✅ |
| 4.1.3 Mensagens de status | `aria-live="polite"` no painel, no resultado do totem e nas mensagens das telas | ✅ |

### 2.3 Acessibilidade específica de totem e painel

- **Totem:** botões grandes, texto grande, linguagem simples, retorno de foco ao resultado para leitores de tela, texto de ajuda explicando cada tipo.
- **Painel:** tema escuro de alto contraste (≥ 10:1), fonte de até 12 rem, anúncio por **voz** (pessoas com baixa visão) **e** por texto/`aria-live` (pessoas surdas ou com deficiência auditiva); a chamada nunca depende só do áudio.

### 2.4 Pendências (honestas)

- ⏳ **Auditoria manual** com leitor de tela (NVDA/VoiceOver) e ferramenta automática (axe/Lighthouse) — prevista no [plano de testes](plano-de-testes.md).
- ⏳ Teste com zoom de 200% e em telas pequenas.
- ⏳ Libras/legendas não se aplicam à versão atual (não há conteúdo de vídeo).
- ⏳ Título de página por rota.
