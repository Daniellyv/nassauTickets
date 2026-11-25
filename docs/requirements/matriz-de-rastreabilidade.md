# Matriz de rastreabilidade

Liga cada requisito às regras, ao código e aos testes automatizados. Caminhos relativos à raiz do repositório.

| Requisito | Regras | Implementação | Testes |
|-----------|--------|---------------|--------|
| RF-001, RF-003 Retirar senha | RN-001 | `backend/src/services/senhaService.js`; `frontend/src/pages/Totem.jsx` | `backend/tests/atendimento.test.js` (emissão); `api.test.js`; `frontend/src/pages/paginas.test.jsx` |
| RF-002 Numeração | RN-030, RN-031 | `senhaService.formatarNumero`; `sequencias_diarias` | `dominio.test.js` (numeração); `atendimento.test.js` (reinício diário, 50 emissões simultâneas) |
| RF-004 Expediente na emissão | RN-020 | `backend/src/services/expedienteService.js` | `atendimento.test.js` (expediente); `api.test.js` (403) |
| RF-005 Priorização | RN-010 a RN-014 | `backend/src/domain/prioridade.js`; `atendimentoService.chamarProxima` | `dominio.test.js`; `atendimento.test.js` (ordem de chamada) |
| RF-006 Qualquer guichê | RN-002 | `atendimentoService` (sem restrição por tipo) | `atendimento.test.js` |
| RF-007 Concorrência | RN-040 | `repo.comTrava` (`mysqlRepository.js`, `memoryRepository.js`) | `atendimento.test.js` (concorrência) — **MySQL real pendente** |
| RF-008 Login | RN-070 | `backend/src/services/authService.js`; `frontend/src/pages/Login.jsx` | `api.test.js` (autenticação e perfis) |
| RF-009 Escolher guichê | RN-015 | `frontend/src/pages/Atendente.jsx` | `atendimento.test.js` (guichê inativo/ocupado) |
| RF-010 Chamar próxima | RN-010, RN-015 | `atendimentoService.chamarProxima` | `atendimento.test.js`; `api.test.js` (fluxo) |
| RF-011 Chamar novamente | RN-016, RN-053 | `atendimentoService.chamarNovamente` | `atendimento.test.js`; `api.test.js` (painel "última chamada") |
| RF-012, RF-013 Iniciar/finalizar | RN-080 | `atendimentoService.iniciar/finalizar` | `atendimento.test.js` (ciclo da senha) |
| RF-014 Não compareceu | RN-016 | `atendimentoService.naoCompareceu` | `atendimento.test.js` |
| RF-015 Retomar atendimento | RN-015 | `atendimentoService.atual`; `Atendente.jsx` | `atendimento.test.js` |
| RF-016 Propriedade da senha | RN-041 | `carregarParaTransicao` | `atendimento.test.js` |
| RF-017 Painel 5 últimas | RN-050, RN-051 | `backend/src/services/painelService.js`; `frontend/src/pages/Painel.jsx` | `api.test.js` (painel); `paginas.test.jsx` |
| RF-018, RF-019 Áudio | RN-052, RN-053 | `frontend/src/hooks/useVozChamada.js`; `utils/formatar.js#textoDaChamada` | `frontend/src/utils/formatar.test.js` (texto falado). **Áudio em si: manual (CT-09, CT-10)** |
| RF-020 Atualização automática | — | `frontend/src/hooks/usePolling.js` | `usePolling.test.jsx` |
| RF-021 Máquina de estados | RN-080 | `backend/src/domain/estados.js` | `dominio.test.js` (máquina de estados) |
| RF-022 Descarte no fim do expediente | RN-021 | `atendimentoService.descartarSobras`; `jobs/expediente.js` | `atendimento.test.js` (expediente) |
| RF-023, RF-024 Atendentes / gestor único | RN-070 a RN-072 | `backend/src/services/cadastroService.js`; `frontend/src/pages/gestor/Usuarios.jsx` | `api.test.js` (cadastros do gestor) |
| RF-025 Guichês | RN-071 | `cadastroService`; `gestor/Guiches.jsx` | `api.test.js` |
| RF-026 a RF-028 Relatórios, TM | RN-018, RN-060 | `backend/src/services/relatorioService.js`; `gestor/Relatorios.jsx` | `relatorios.test.js` |
| RF-027 Detalhado | RN-061 | `relatorioService.montarDetalhado` | `relatorios.test.js` |
| RF-029 Auditoria | RN-062 | `montarAuditoria`; tabela `eventos_senha` | `relatorios.test.js`; `atendimento.test.js` (trilha de auditoria) |
| RF-030 CSV | — | `backend/src/utils/csv.js` | `relatorios.test.js` (CSV) |
| RF-031 Indicadores | — | `montarResumo` | `relatorios.test.js` |
| RF-032 Simulador | RN-017, RN-018 | `backend/scripts/simulate.js` | execução manual (ver `desempenho-e-kpis.md`) |
| RF-033 / RNF-010 Resiliência | — | `usePolling.js`; `StatusBanner.jsx`; `middlewares/erro.js` | `usePolling.test.jsx`; `componentes.test.jsx`; `paginas.test.jsx` (painel/totem offline) |
| RNF-001 a RNF-008 Segurança | — | `authService`, `middlewares/*`, `app.js` | `api.test.js` |
| RNF-020 Auditoria | — | `eventos_senha` (somente inserção) | `atendimento.test.js` |
| RNF-050 a RNF-053 Acessibilidade | — | `frontend/src/styles/global.css`, componentes | parcialmente `paginas.test.jsx`; auditoria manual **pendente** |
