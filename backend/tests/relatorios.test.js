import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { gerarCsv } from '../src/utils/csv.js';
import { montarResumo, resolverPeriodo } from '../src/services/relatorioService.js';
import { criarContexto, entrar } from './helpers.js';

const minutos = (n) => n * 60_000;

/** Atende uma senha com duração e espera controladas pelo relógio do contexto. */
async function atenderComDuracao(ctx, usuario, guicheId, duracaoMs) {
  const chamada = await ctx.servicos.atendimento.chamarProxima(usuario, guicheId);
  ctx.avancar(10_000);
  await ctx.servicos.atendimento.iniciar(usuario, chamada.id);
  ctx.avancar(duracaoMs);
  await ctx.servicos.atendimento.finalizar(usuario, chamada.id);
  return chamada;
}

describe('períodos', () => {
  it('resolve dia e mês', () => {
    assert.deepEqual(resolverPeriodo({ data: '2026-03-25' }), {
      tipo: 'diario',
      referencia: '2026-03-25',
      inicio: '2026-03-25',
      fimExclusivo: '2026-03-26',
    });
    assert.deepEqual(resolverPeriodo({ mes: '2026-12' }), {
      tipo: 'mensal',
      referencia: '2026-12',
      inicio: '2026-12-01',
      fimExclusivo: '2027-01-01',
    });
    assert.equal(resolverPeriodo({ data: '2026-12-31' }).fimExclusivo, '2027-01-01');
  });

  it('usa a data local de hoje quando nada é informado', () => {
    const p = resolverPeriodo({}, new Date('2026-03-25T13:00:00Z'));
    assert.equal(p.referencia, '2026-03-25');
  });

  it('rejeita formatos inválidos', () => {
    assert.throws(() => resolverPeriodo({ data: '25/03/2026' }), { codigo: 'requisicao_invalida' });
    assert.throws(() => resolverPeriodo({ mes: '2026-13' }), { codigo: 'requisicao_invalida' });
    assert.throws(() => resolverPeriodo({ data: '2026-02-30' }), { codigo: 'requisicao_invalida' });
    assert.throws(() => resolverPeriodo({ data: '2026-03-25', mes: '2026-03' }), {
      codigo: 'requisicao_invalida',
    });
  });
});

describe('montarResumo', () => {
  it('retorna zeros e null quando não há senhas', () => {
    const r = montarResumo([]);
    assert.deepEqual(r.totais, { emitidas: 0, atendidas: 0, naoCompareceu: 0, descartadas: 0 });
    assert.equal(r.tm.geral, null);
    assert.equal(r.desempenho.taxaAtendimento, 0);
  });
});

describe('relatórios de ponta a ponta', () => {
  async function cenario() {
    const ctx = await criarContexto();
    const a = await ctx.usuario('atendente');
    const b = await ctx.novoAtendente('b');
    const g1 = await ctx.guiche(1);
    const g2 = await ctx.guiche(2);

    await ctx.emitir('SP', 'SE', 'SG', 'SG', 'SG', 'SP');
    // SP001 (5 min) pelo atendente A
    await atenderComDuracao(ctx, a, g1.id, minutos(5));
    // SE001 (1 min) pelo atendente B
    await atenderComDuracao(ctx, b, g2.id, minutos(1));
    // SP002 (15 min) pelo atendente A
    await atenderComDuracao(ctx, a, g1.id, minutos(15));
    // SG001 não comparece (duas chamadas)
    const falta = await ctx.servicos.atendimento.chamarProxima(a, g1.id);
    ctx.avancar(minutos(1));
    await ctx.servicos.atendimento.chamarNovamente(a, falta.id);
    ctx.avancar(minutos(1));
    await ctx.servicos.atendimento.naoCompareceu(a, falta.id);
    // SG002 (3 min) pelo atendente B
    await atenderComDuracao(ctx, b, g2.id, minutos(3));
    // SG003 continua AGUARDANDO
    return ctx;
  }

  it('calcula quantitativos gerais e por prioridade', async () => {
    const ctx = await cenario();
    const r = await ctx.servicos.relatorios.resumo({ data: '2026-03-25' });

    assert.deepEqual(r.totais, { emitidas: 6, atendidas: 4, naoCompareceu: 1, descartadas: 0 });
    assert.deepEqual(r.porTipo.SP, { emitidas: 2, atendidas: 2, naoCompareceu: 0, descartadas: 0 });
    assert.deepEqual(r.porTipo.SE, { emitidas: 1, atendidas: 1, naoCompareceu: 0, descartadas: 0 });
    assert.deepEqual(r.porTipo.SG, { emitidas: 3, atendidas: 1, naoCompareceu: 1, descartadas: 0 });
  });

  it('calcula o tempo médio de atendimento (TM) por tipo', async () => {
    const ctx = await cenario();
    const r = await ctx.servicos.relatorios.resumo({ data: '2026-03-25' });
    assert.equal(r.tm.porTipo.SP, 10 * 60); // (5 + 15) / 2
    assert.equal(r.tm.porTipo.SE, 60);
    assert.equal(r.tm.porTipo.SG, 3 * 60);
    assert.equal(r.tm.geral, Math.round((300 + 900 + 60 + 180) / 4));
  });

  it('calcula indicadores de desempenho por atendente', async () => {
    const ctx = await cenario();
    const r = await ctx.servicos.relatorios.resumo({ data: '2026-03-25' });
    assert.equal(r.desempenho.taxaAtendimento, 66.7);
    assert.equal(r.desempenho.taxaNaoComparecimento, 16.7);
    const porNome = Object.fromEntries(r.desempenho.porAtendente.map((x) => [x.atendente, x]));
    assert.equal(porNome['Atendente do Laboratório'].atendidas, 2);
    assert.equal(porNome['Atendente b'].atendidas, 2);
    assert.ok(r.desempenho.porHora.length >= 1);
  });

  it('o relatório mensal consolida vários dias', async () => {
    const ctx = await cenario();
    ctx.definirAgora('2026-03-26T13:00:00Z');
    await ctx.emitir('SG');
    const mensal = await ctx.servicos.relatorios.resumo({ mes: '2026-03' });
    assert.equal(mensal.totais.emitidas, 7);
    assert.equal(mensal.desempenho.porDia.length, 2);
    const diario = await ctx.servicos.relatorios.resumo({ data: '2026-03-26' });
    assert.equal(diario.totais.emitidas, 1);
    const outroMes = await ctx.servicos.relatorios.resumo({ mes: '2026-04' });
    assert.equal(outroMes.totais.emitidas, 0);
  });

  it('o detalhado deixa em branco os campos de atendimento das senhas não atendidas', async () => {
    const ctx = await cenario();
    const { itens } = await ctx.servicos.relatorios.detalhado({ data: '2026-03-25' });
    assert.equal(itens.length, 6);
    const atendida = itens.find((i) => i.numero === '260325-SP001');
    assert.ok(atendida.atendidaEm);
    assert.ok(atendida.guiche);
    for (const numero of ['260325-SG001', '260325-SG003']) {
      const i = itens.find((x) => x.numero === numero);
      assert.equal(i.atendidaEm, null);
      assert.equal(i.guiche, null);
    }
  });

  it('a auditoria registra atendente, guichê e horários de cada etapa', async () => {
    const ctx = await cenario();
    const { itens } = await ctx.servicos.relatorios.auditoria({ data: '2026-03-25' });
    assert.equal(itens.length, 5, 'só senhas que chegaram a ser chamadas');
    const faltou = itens.find((i) => i.senha === '260325-SG001');
    assert.ok(faltou.primeiraChamadaEm);
    assert.ok(faltou.segundaChamadaEm);
    assert.equal(faltou.inicioAtendimentoEm, null);
    assert.equal(faltou.estadoFinal, 'NAO_COMPARECEU');
    const atendida = itens.find((i) => i.senha === '260325-SP001');
    assert.equal(atendida.segundaChamadaEm, null);
    assert.ok(atendida.inicioAtendimentoEm && atendida.fimAtendimentoEm);
    assert.ok(atendida.atendente);
  });

  it('exporta CSV com cabeçalho em português', async () => {
    const ctx = await cenario();
    const token = await entrar(ctx.app, request, 'gestor', 'Gestor@123');
    const r = await request(ctx.app)
      .get('/api/relatorios/detalhado?data=2026-03-25&formato=csv')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/csv/);
    assert.match(r.headers['content-disposition'], /senhas-2026-03-25\.csv/);
    const linhas = r.text.replace('﻿', '').trim().split(/\r?\n/);
    assert.equal(linhas[0], 'Senha;Tipo;Situação;Emissão;Atendimento;Guichê');
    assert.equal(linhas.length, 7);
    assert.match(linhas[1], /^260325-SP001;SP;ATENDIDA;25\/03\/2026 10:00:00;/);
  });

  it('valida o período na API', async () => {
    const ctx = await criarContexto();
    const token = await entrar(ctx.app, request, 'gestor', 'Gestor@123');
    const r = await request(ctx.app).get('/api/relatorios/diario?data=ontem').set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 400);
  });
});

describe('CSV', () => {
  it('escapa separadores, aspas e neutraliza fórmulas', () => {
    const csv = gerarCsv(
      [
        { titulo: 'A', campo: 'a' },
        { titulo: 'B', campo: 'b' },
      ],
      [{ a: 'x;y', b: '=1+1' }, { a: 'diz "oi"', b: null }],
    ).replace('﻿', '');
    assert.equal(csv, 'A;B\r\n"x;y";\'=1+1\r\n"diz ""oi""";\r\n');
  });
});
