/** Handlers HTTP: só traduzem requisição/resposta; as regras ficam nos serviços. */
export function criarControllers(s) {
  const dados = (req, origem = 'body') => req.dados[origem];

  const enviarCsv = (res, nome, csv) => {
    res.type('text/csv; charset=utf-8').attachment(nome).send(csv);
  };

  return {
    async health(_req, res) {
      try {
        await s.repo.health();
        res.json({ status: 'ok', banco: 'ok' });
      } catch {
        res.status(503).json({ status: 'degradado', banco: 'indisponivel' });
      }
    },

    // ---- público (totem e painel) ----
    async emitirSenha(req, res) {
      const senha = await s.senhas.emitir(dados(req).tipo);
      res.status(201).json({ senha });
    },
    async painel(_req, res) {
      res.json(await s.painel.ultimasChamadas());
    },

    // ---- autenticação ----
    async login(req, res) {
      const { usuario, senha } = dados(req);
      res.json(await s.auth.login(usuario, senha));
    },
    async eu(req, res) {
      res.json({ usuario: req.usuario });
    },

    // ---- atendimento ----
    async chamarProxima(req, res) {
      const senha = await s.atendimento.chamarProxima(req.usuario, dados(req).guicheId);
      res.json({ senha, mensagem: senha ? undefined : 'Não há senhas aguardando.' });
    },
    async chamarNovamente(req, res) {
      res.json({ senha: await s.atendimento.chamarNovamente(req.usuario, dados(req, 'params').id) });
    },
    async iniciar(req, res) {
      res.json({ senha: await s.atendimento.iniciar(req.usuario, dados(req, 'params').id) });
    },
    async finalizar(req, res) {
      res.json({ senha: await s.atendimento.finalizar(req.usuario, dados(req, 'params').id) });
    },
    async naoCompareceu(req, res) {
      res.json({ senha: await s.atendimento.naoCompareceu(req.usuario, dados(req, 'params').id) });
    },
    async atendimentoAtual(req, res) {
      res.json({ senha: await s.atendimento.atual(req.usuario) });
    },
    async filas(_req, res) {
      res.json({
        filas: await s.atendimento.filas(),
        expedienteAberto: s.expediente.aberto(s.relogio()),
      });
    },

    // ---- cadastros (gestor) ----
    async listarUsuarios(_req, res) {
      res.json({ usuarios: await s.cadastros.listarUsuarios() });
    },
    async criarUsuario(req, res) {
      res.status(201).json({ usuario: await s.cadastros.criarUsuario(dados(req)) });
    },
    async atualizarUsuario(req, res) {
      const { id } = dados(req, 'params');
      res.json({ usuario: await s.cadastros.atualizarUsuario(id, dados(req)) });
    },
    async listarGuiches(_req, res) {
      res.json({ guiches: await s.cadastros.listarGuiches() });
    },
    async criarGuiche(req, res) {
      res.status(201).json({ guiche: await s.cadastros.criarGuiche(dados(req)) });
    },
    async atualizarGuiche(req, res) {
      const { id } = dados(req, 'params');
      res.json({ guiche: await s.cadastros.atualizarGuiche(id, dados(req)) });
    },

    // ---- relatórios (gestor) ----
    async relatorioResumo(req, res) {
      res.json(await s.relatorios.resumo(dados(req, 'query')));
    },
    async relatorioDetalhado(req, res) {
      const consulta = dados(req, 'query');
      const resultado = await s.relatorios.detalhado(consulta, consulta.formato);
      if (consulta.formato === 'csv') {
        return enviarCsv(res, `senhas-${consulta.mes ?? consulta.data ?? 'hoje'}.csv`, resultado);
      }
      return res.json(resultado);
    },
    async relatorioAuditoria(req, res) {
      const consulta = dados(req, 'query');
      const resultado = await s.relatorios.auditoria(consulta, consulta.formato);
      if (consulta.formato === 'csv') {
        return enviarCsv(res, `auditoria-${consulta.mes ?? consulta.data ?? 'hoje'}.csv`, resultado);
      }
      return res.json(resultado);
    },
  };
}
