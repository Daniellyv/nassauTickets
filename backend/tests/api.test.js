import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { criarContexto, entrar } from './helpers.js';

describe('API pública (totem e painel)', () => {
  it('GET /api/health responde ok', async () => {
    const { app } = await criarContexto();
    const r = await request(app).get('/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { status: 'ok', banco: 'ok' });
  });

  it('POST /api/senhas emite senha sem autenticação (cliente anônimo)', async () => {
    const { app } = await criarContexto();
    const r = await request(app).post('/api/senhas').send({ tipo: 'SP' });
    assert.equal(r.status, 201);
    assert.equal(r.body.senha.numero, '260325-SP001');
    assert.equal(r.body.senha.estado, 'AGUARDANDO');
  });

  it('POST /api/senhas valida o corpo', async () => {
    const { app } = await criarContexto();
    assert.equal((await request(app).post('/api/senhas').send({ tipo: 'XX' })).status, 400);
    assert.equal((await request(app).post('/api/senhas').send({})).status, 400);
    assert.equal(
      (await request(app).post('/api/senhas').send({ tipo: 'SG', nome: 'Maria' })).status,
      400,
      'campos extras (dados pessoais) devem ser rejeitados',
    );
  });

  it('retorna 403 fora do expediente', async () => {
    const { app } = await criarContexto({ aplicarExpediente: true, agora: '2026-03-25T05:00:00Z' });
    const r = await request(app).post('/api/senhas').send({ tipo: 'SG' });
    assert.equal(r.status, 403);
    assert.equal(r.body.erro, 'fora_do_expediente');
  });

  it('o painel mostra só as 5 últimas chamadas e nunca a próxima', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG', 'SG', 'SG', 'SG', 'SG', 'SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    for (let i = 0; i < 6; i += 1) {
      await ctx.atenderProxima(atendente, guiche.id);
      ctx.avancar(1000);
    }

    const r = await request(ctx.app).get('/api/painel');
    assert.equal(r.status, 200);
    const numeros = r.body.chamadas.map((c) => c.numero);
    assert.deepEqual(numeros, [
      '260325-SG006',
      '260325-SG005',
      '260325-SG004',
      '260325-SG003',
      '260325-SG002',
    ]);
    assert.ok(!numeros.includes('260325-SG007'), 'a próxima senha não pode aparecer');
  });

  it('o painel marca a "última chamada" depois do Chamar Novamente', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SP');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(2);
    const c = await ctx.servicos.atendimento.chamarProxima(atendente, guiche.id);

    let painel = (await request(ctx.app).get('/api/painel')).body;
    assert.equal(painel.chamadas[0].ultimaChamada, false);
    assert.equal(painel.chamadas[0].guiche, 2);

    ctx.avancar(30_000);
    await ctx.servicos.atendimento.chamarNovamente(atendente, c.id);
    painel = (await request(ctx.app).get('/api/painel')).body;
    assert.equal(painel.chamadas.length, 1);
    assert.equal(painel.chamadas[0].ultimaChamada, true);
    assert.equal(painel.chamadas[0].numChamadas, 2);
  });

  it('rota inexistente retorna 404 em JSON', async () => {
    const { app } = await criarContexto();
    const r = await request(app).get('/api/nao-existe');
    assert.equal(r.status, 404);
    assert.equal(r.body.erro, 'rota_nao_encontrada');
  });

  it('JSON malformado retorna 400', async () => {
    const { app } = await criarContexto();
    const r = await request(app).post('/api/senhas').set('Content-Type', 'application/json').send('{ruim');
    assert.equal(r.status, 400);
  });
});

describe('autenticação e perfis', () => {
  it('faz login e devolve token + usuário (sem hash de senha)', async () => {
    const { app } = await criarContexto();
    const r = await request(app).post('/api/auth/login').send({ usuario: 'atendente', senha: 'Atendente@123' });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.usuario.perfil, 'ATENDENTE');
    assert.equal(JSON.stringify(r.body).includes('hash'), false);
  });

  it('rejeita senha errada e usuário inexistente com a mesma resposta', async () => {
    const { app } = await criarContexto();
    const errada = await request(app).post('/api/auth/login').send({ usuario: 'atendente', senha: 'x' });
    const inexistente = await request(app).post('/api/auth/login').send({ usuario: 'ninguem', senha: 'x' });
    assert.equal(errada.status, 401);
    assert.equal(inexistente.status, 401);
    assert.deepEqual(errada.body, inexistente.body);
  });

  it('usuário inativo não consegue entrar nem usar token antigo', async () => {
    const ctx = await criarContexto();
    const token = await entrar(ctx.app, request, 'atendente', 'Atendente@123');
    const usuario = await ctx.usuario('atendente');
    await ctx.repo.atualizarUsuario(usuario.id, { ativo: 0 });

    assert.equal((await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
    const r = await request(ctx.app).post('/api/auth/login').send({ usuario: 'atendente', senha: 'Atendente@123' });
    assert.equal(r.status, 401);
  });

  it('exige token nas rotas do atendente', async () => {
    const { app } = await criarContexto();
    assert.equal((await request(app).get('/api/atendimento/atual')).status, 401);
    assert.equal((await request(app).post('/api/atendimento/chamar-proxima').send({ guicheId: 1 })).status, 401);
    assert.equal(
      (await request(app).get('/api/atendimento/atual').set('Authorization', 'Bearer lixo')).status,
      401,
    );
  });

  it('atendente não acessa cadastros nem relatórios (403); gestor acessa', async () => {
    const { app } = await criarContexto();
    const atendente = await entrar(app, request, 'atendente', 'Atendente@123');
    const gestor = await entrar(app, request, 'gestor', 'Gestor@123');

    for (const rota of ['/api/usuarios', '/api/relatorios/diario', '/api/relatorios/auditoria']) {
      assert.equal((await request(app).get(rota).set('Authorization', `Bearer ${atendente}`)).status, 403, rota);
      assert.equal((await request(app).get(rota).set('Authorization', `Bearer ${gestor}`)).status, 200, rota);
    }
    const guichePost = await request(app)
      .post('/api/guiches')
      .set('Authorization', `Bearer ${atendente}`)
      .send({ numero: 9 });
    assert.equal(guichePost.status, 403);
  });

  it('atendente e gestor podem listar guichês', async () => {
    const { app } = await criarContexto();
    const token = await entrar(app, request, 'atendente', 'Atendente@123');
    const r = await request(app).get('/api/guiches').set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.guiches.length, 3);
  });

  it('limita tentativas de login (rate limit)', async () => {
    const { app } = await criarContexto({
      limites: {
        login: { janelaMs: 60_000, limite: 3 },
        senhas: { janelaMs: 1000, limite: 1000 },
      },
    });
    const status = [];
    for (let i = 0; i < 5; i += 1) {
      status.push((await request(app).post('/api/auth/login').send({ usuario: 'x', senha: 'y' })).status);
    }
    assert.deepEqual(status, [401, 401, 401, 429, 429]);
  });
});

describe('fluxo completo pela API', () => {
  it('totem -> atendente chama, chama novamente, inicia e finaliza', async () => {
    const { app } = await criarContexto();
    const token = await entrar(app, request, 'atendente', 'Atendente@123');
    const auth = { Authorization: `Bearer ${token}` };
    const guiches = (await request(app).get('/api/guiches').set(auth)).body.guiches;

    const emitida = (await request(app).post('/api/senhas').send({ tipo: 'SG' })).body.senha;
    const filas = (await request(app).get('/api/atendimento/filas').set(auth)).body.filas;
    assert.equal(filas.SG, 1);

    const chamada = (
      await request(app).post('/api/atendimento/chamar-proxima').set(auth).send({ guicheId: guiches[0].id })
    ).body.senha;
    assert.equal(chamada.id, emitida.id);
    assert.equal(chamada.estado, 'CHAMADA');

    const atual = (await request(app).get('/api/atendimento/atual').set(auth)).body.senha;
    assert.equal(atual.id, emitida.id);

    const nova = await request(app).post(`/api/atendimento/${emitida.id}/chamar-novamente`).set(auth);
    assert.equal(nova.body.senha.estado, 'CHAMADA_NOVAMENTE');
    const inicio = await request(app).post(`/api/atendimento/${emitida.id}/iniciar`).set(auth);
    assert.equal(inicio.body.senha.estado, 'EM_ATENDIMENTO');
    const fim = await request(app).post(`/api/atendimento/${emitida.id}/finalizar`).set(auth);
    assert.equal(fim.body.senha.estado, 'ATENDIDA');
  });

  it('transição inválida retorna 409 e id inválido retorna 400', async () => {
    const { app } = await criarContexto();
    const token = await entrar(app, request, 'atendente', 'Atendente@123');
    const auth = { Authorization: `Bearer ${token}` };
    const guiches = (await request(app).get('/api/guiches').set(auth)).body.guiches;
    const { senha } = (await request(app).post('/api/senhas').send({ tipo: 'SG' })).body;
    await request(app).post('/api/atendimento/chamar-proxima').set(auth).send({ guicheId: guiches[0].id });

    const invalida = await request(app).post(`/api/atendimento/${senha.id}/finalizar`).set(auth);
    assert.equal(invalida.status, 409);
    assert.equal(invalida.body.erro, 'transicao_invalida');
    assert.equal((await request(app).post('/api/atendimento/abc/iniciar').set(auth)).status, 400);
    assert.equal((await request(app).post('/api/atendimento/9999/iniciar').set(auth)).status, 404);
  });

  it('fila vazia retorna senha null', async () => {
    const { app } = await criarContexto();
    const token = await entrar(app, request, 'atendente', 'Atendente@123');
    const auth = { Authorization: `Bearer ${token}` };
    const guiches = (await request(app).get('/api/guiches').set(auth)).body.guiches;
    const r = await request(app).post('/api/atendimento/chamar-proxima').set(auth).send({ guicheId: guiches[0].id });
    assert.equal(r.status, 200);
    assert.equal(r.body.senha, null);
  });
});

describe('cadastros do gestor', () => {
  const comToken = async (ctx) => ({
    Authorization: `Bearer ${await entrar(ctx.app, request, 'gestor', 'Gestor@123')}`,
  });

  it('cria atendente e ele consegue entrar', async () => {
    const ctx = await criarContexto();
    const auth = await comToken(ctx);
    const r = await request(ctx.app)
      .post('/api/usuarios')
      .set(auth)
      .send({ nome: 'Maria Souza', usuario: 'maria', senha: 'SenhaForte1', perfil: 'ATENDENTE' });
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario.usuario, 'maria');
    assert.ok(await entrar(ctx.app, request, 'maria', 'SenhaForte1'));
  });

  it('não permite login duplicado nem senha curta', async () => {
    const ctx = await criarContexto();
    const auth = await comToken(ctx);
    const dados = { nome: 'Outra Pessoa', usuario: 'atendente', senha: 'SenhaForte1', perfil: 'ATENDENTE' };
    assert.equal((await request(ctx.app).post('/api/usuarios').set(auth).send(dados)).status, 409);
    assert.equal(
      (await request(ctx.app).post('/api/usuarios').set(auth).send({ ...dados, usuario: 'nova', senha: '123' })).status,
      400,
    );
  });

  it('admite um único gestor ativo', async () => {
    const ctx = await criarContexto();
    const auth = await comToken(ctx);
    const r = await request(ctx.app)
      .post('/api/usuarios')
      .set(auth)
      .send({ nome: 'Segundo Gestor', usuario: 'gestor2', senha: 'SenhaForte1', perfil: 'GESTOR' });
    assert.equal(r.status, 409);
    assert.equal(r.body.erro, 'gestor_unico');
  });

  it('não permite desativar nem rebaixar o único gestor', async () => {
    const ctx = await criarContexto();
    const auth = await comToken(ctx);
    const gestor = await ctx.usuario('gestor');
    const desativar = await request(ctx.app).put(`/api/usuarios/${gestor.id}`).set(auth).send({ ativo: false });
    assert.equal(desativar.status, 409);
    assert.equal(desativar.body.erro, 'ultimo_gestor');
    const rebaixar = await request(ctx.app).put(`/api/usuarios/${gestor.id}`).set(auth).send({ perfil: 'ATENDENTE' });
    assert.equal(rebaixar.status, 409);
  });

  it('desativa e redefine a senha de um atendente', async () => {
    const ctx = await criarContexto();
    const auth = await comToken(ctx);
    const atendente = await ctx.usuario('atendente');
    const r = await request(ctx.app)
      .put(`/api/usuarios/${atendente.id}`)
      .set(auth)
      .send({ senha: 'NovaSenha123' });
    assert.equal(r.status, 200);
    assert.ok(await entrar(ctx.app, request, 'atendente', 'NovaSenha123'));
    await request(ctx.app).put(`/api/usuarios/${atendente.id}`).set(auth).send({ ativo: false });
    assert.equal(await entrar(ctx.app, request, 'atendente', 'NovaSenha123'), undefined);
  });

  it('cria e desativa guichês; guichê duplicado retorna 409', async () => {
    const ctx = await criarContexto();
    const auth = await comToken(ctx);
    const novo = await request(ctx.app).post('/api/guiches').set(auth).send({ numero: 7 });
    assert.equal(novo.status, 201);
    assert.equal((await request(ctx.app).post('/api/guiches').set(auth).send({ numero: 7 })).status, 409);
    const off = await request(ctx.app).put(`/api/guiches/${novo.body.guiche.id}`).set(auth).send({ ativo: false });
    assert.equal(off.body.guiche.ativo, false);
  });

  it('não desativa um guichê em atendimento', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const auth = await comToken(ctx);
    const guiche = await ctx.guiche(1);
    await ctx.servicos.atendimento.chamarProxima(await ctx.usuario('atendente'), guiche.id);
    const r = await request(ctx.app).put(`/api/guiches/${guiche.id}`).set(auth).send({ ativo: false });
    assert.equal(r.status, 409);
  });
});
