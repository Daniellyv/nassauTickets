import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESTADOS } from '../src/domain/estados.js';
import { criarContexto } from './helpers.js';

const codigoDe = (promessa) =>
  promessa.then(
    () => null,
    (erro) => erro.codigo,
  );

describe('emissão de senhas', () => {
  it('numera por tipo no formato YYMMDD-PPSQ e retorna AGUARDANDO', async () => {
    const ctx = await criarContexto();
    const [sp1, sg1, sg2, se1] = await ctx.emitir('SP', 'SG', 'SG', 'SE');
    assert.equal(sp1.numero, '260325-SP001');
    assert.equal(sg1.numero, '260325-SG001');
    assert.equal(sg2.numero, '260325-SG002');
    assert.equal(se1.numero, '260325-SE001');
    assert.equal(sp1.estado, ESTADOS.AGUARDANDO);
  });

  it('informa quantas pessoas já aguardam à frente', async () => {
    const ctx = await criarContexto();
    const [a, b, c] = await ctx.emitir('SG', 'SG', 'SP');
    assert.deepEqual([a.aguardandoNaFrente, b.aguardandoNaFrente, c.aguardandoNaFrente], [0, 1, 2]);
  });

  it('reinicia a sequência a cada dia', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG');
    ctx.avancar(24 * 60 * 60 * 1000);
    const [amanha] = await ctx.emitir('SG');
    assert.equal(amanha.numero, '260326-SG001');
  });

  it('rejeita tipo desconhecido', async () => {
    const ctx = await criarContexto();
    assert.equal(await codigoDe(ctx.servicos.senhas.emitir('XX')), 'requisicao_invalida');
  });

  it('registra os eventos EMITIDA e AGUARDANDO na auditoria', async () => {
    const ctx = await criarContexto();
    const [senha] = await ctx.emitir('SG');
    const eventos = await ctx.repo.eventosDaSenha(senha.id);
    assert.deepEqual(
      eventos.map((e) => [e.estado_anterior, e.estado_novo]),
      [
        [null, ESTADOS.EMITIDA],
        [ESTADOS.EMITIDA, ESTADOS.AGUARDANDO],
      ],
    );
  });
});

describe('expediente (07:00 às 17:00)', () => {
  it('bloqueia emissão e chamada fora do horário', async () => {
    const ctx = await criarContexto({ aplicarExpediente: true, agora: '2026-03-25T09:00:00Z' }); // 06:00 local
    assert.equal(await codigoDe(ctx.servicos.senhas.emitir('SG')), 'fora_do_expediente');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    assert.equal(
      await codigoDe(ctx.servicos.atendimento.chamarProxima(atendente, guiche.id)),
      'fora_do_expediente',
    );
  });

  it('permite dentro do horário e bloqueia a partir das 17:00', async () => {
    const ctx = await criarContexto({ aplicarExpediente: true, agora: '2026-03-25T10:00:00Z' }); // 07:00
    await ctx.servicos.senhas.emitir('SG');
    ctx.definirAgora('2026-03-25T19:59:00Z'); // 16:59
    await ctx.servicos.senhas.emitir('SG');
    ctx.definirAgora('2026-03-25T20:00:00Z'); // 17:00
    assert.equal(await codigoDe(ctx.servicos.senhas.emitir('SG')), 'fora_do_expediente');
  });

  it('descarta as senhas que sobraram no fim do expediente', async () => {
    const ctx = await criarContexto({ aplicarExpediente: true, agora: '2026-03-25T15:00:00Z' });
    const [senha] = await ctx.emitir('SG');
    assert.equal(await ctx.servicos.atendimento.descartarSobras(), 0);

    ctx.definirAgora('2026-03-25T20:01:00Z'); // 17:01
    assert.equal(await ctx.servicos.atendimento.descartarSobras(), 1);
    assert.equal((await ctx.repo.comTrava((tx) => tx.buscarSenha(senha.id))).estado, ESTADOS.DESCARTADA);
    assert.equal(await ctx.servicos.atendimento.descartarSobras(), 0);
  });

  it('descarta senhas de dias anteriores que ficaram na fila', async () => {
    const ctx = await criarContexto({ aplicarExpediente: true, agora: '2026-03-25T15:00:00Z' });
    await ctx.emitir('SG');
    ctx.definirAgora('2026-03-26T11:00:00Z'); // dia seguinte, 08:00
    assert.equal(await ctx.servicos.atendimento.descartarSobras(), 1);
  });
});

describe('ordem de chamada', () => {
  it('respeita SP -> SE -> SP -> SG com filas variadas', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG', 'SE', 'SP', 'SP', 'SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);

    const ordem = [];
    for (let i = 0; i < 6; i += 1) ordem.push(await ctx.atenderProxima(atendente, guiche.id));

    assert.deepEqual(ordem, [
      '260325-SP001',
      '260325-SE001',
      '260325-SP002',
      '260325-SG001',
      '260325-SG002',
      '260325-SG003',
    ]);
  });

  it('atende por ordem de chegada dentro do mesmo tipo', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG', 'SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    const ordem = [];
    for (let i = 0; i < 3; i += 1) ordem.push(await ctx.atenderProxima(atendente, guiche.id));
    assert.deepEqual(ordem, ['260325-SG001', '260325-SG002', '260325-SG003']);
  });

  it('uma SP emitida depois passa na frente das SG que já esperavam', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG');
    await ctx.emitir('SP');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    assert.equal(await ctx.atenderProxima(atendente, guiche.id), '260325-SP001');
  });

  it('retorna null quando não há senhas aguardando', async () => {
    const ctx = await criarContexto();
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    assert.equal(await ctx.servicos.atendimento.chamarProxima(atendente, guiche.id), null);
  });
});

describe('ciclo da senha no guichê', () => {
  it('percorre CHAMADA -> CHAMADA_NOVAMENTE -> EM_ATENDIMENTO -> ATENDIDA', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(2);
    const { atendimento } = ctx.servicos;

    const chamada = await atendimento.chamarProxima(atendente, guiche.id);
    assert.equal(chamada.estado, ESTADOS.CHAMADA);
    assert.equal(chamada.guiche, 2);
    assert.equal(chamada.numChamadas, 1);

    const nova = await atendimento.chamarNovamente(atendente, chamada.id);
    assert.equal(nova.estado, ESTADOS.CHAMADA_NOVAMENTE);
    assert.equal(nova.numChamadas, 2);
    assert.ok(nova.segundaChamadaEm);

    ctx.avancar(60_000);
    const emAtendimento = await atendimento.iniciar(atendente, chamada.id);
    assert.equal(emAtendimento.estado, ESTADOS.EM_ATENDIMENTO);

    ctx.avancar(5 * 60_000);
    const fim = await atendimento.finalizar(atendente, chamada.id);
    assert.equal(fim.estado, ESTADOS.ATENDIDA);
    assert.ok(fim.fimAtendimentoEm > fim.inicioAtendimentoEm);
  });

  it('permite iniciar o atendimento já na primeira chamada', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    const chamada = await ctx.servicos.atendimento.chamarProxima(atendente, guiche.id);
    const r = await ctx.servicos.atendimento.iniciar(atendente, chamada.id);
    assert.equal(r.estado, ESTADOS.EM_ATENDIMENTO);
  });

  it('só marca NÃO_COMPARECEU após a segunda chamada', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    const { atendimento } = ctx.servicos;
    const chamada = await atendimento.chamarProxima(atendente, guiche.id);

    assert.equal(await codigoDe(atendimento.naoCompareceu(atendente, chamada.id)), 'transicao_invalida');
    await atendimento.chamarNovamente(atendente, chamada.id);
    const r = await atendimento.naoCompareceu(atendente, chamada.id);
    assert.equal(r.estado, ESTADOS.NAO_COMPARECEU);
  });

  it('libera o atendente para a próxima senha depois de NÃO_COMPARECEU', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    const { atendimento } = ctx.servicos;
    const primeira = await atendimento.chamarProxima(atendente, guiche.id);
    await atendimento.chamarNovamente(atendente, primeira.id);
    await atendimento.naoCompareceu(atendente, primeira.id);

    const segunda = await atendimento.chamarProxima(atendente, guiche.id);
    assert.equal(segunda.numero, '260325-SG002');
  });

  it('não permite uma terceira chamada nem pular etapas (409)', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    const { atendimento } = ctx.servicos;
    const chamada = await atendimento.chamarProxima(atendente, guiche.id);

    assert.equal(await codigoDe(atendimento.finalizar(atendente, chamada.id)), 'transicao_invalida');
    await atendimento.chamarNovamente(atendente, chamada.id);
    assert.equal(await codigoDe(atendimento.chamarNovamente(atendente, chamada.id)), 'transicao_invalida');
  });

  it('impede chamar outra senha enquanto há atendimento em aberto', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    await ctx.servicos.atendimento.chamarProxima(atendente, guiche.id);
    assert.equal(
      await codigoDe(ctx.servicos.atendimento.chamarProxima(atendente, guiche.id)),
      'atendimento_em_aberto',
    );
  });

  it('impede que outro atendente aja sobre a senha', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const dono = await ctx.usuario('atendente');
    const outro = await ctx.novoAtendente('outro');
    const guiche = await ctx.guiche(1);
    const chamada = await ctx.servicos.atendimento.chamarProxima(dono, guiche.id);
    assert.equal(
      await codigoDe(ctx.servicos.atendimento.iniciar(outro, chamada.id)),
      'senha_de_outro_atendente',
    );
  });

  it('retoma o atendimento em aberto após recarregar a tela', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    assert.equal(await ctx.servicos.atendimento.atual(atendente), null);
    const chamada = await ctx.servicos.atendimento.chamarProxima(atendente, guiche.id);
    assert.equal((await ctx.servicos.atendimento.atual(atendente)).id, chamada.id);
  });

  it('rejeita guichê inexistente ou inativo', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    assert.equal(await codigoDe(ctx.servicos.atendimento.chamarProxima(atendente, 999)), 'nao_encontrado');
    const guiche = await ctx.guiche(1);
    await ctx.repo.atualizarGuiche(guiche.id, { ativo: 0 });
    assert.equal(
      await codigoDe(ctx.servicos.atendimento.chamarProxima(atendente, guiche.id)),
      'nao_encontrado',
    );
  });

  it('grava a trilha de auditoria completa com atendente e guichê', async () => {
    const ctx = await criarContexto();
    const [senha] = await ctx.emitir('SG');
    const atendente = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(3);
    await ctx.atenderProxima(atendente, guiche.id);

    const eventos = await ctx.repo.eventosDaSenha(senha.id);
    assert.deepEqual(
      eventos.map((e) => e.estado_novo),
      ['EMITIDA', 'AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO', 'ATENDIDA'],
    );
    const chamada = eventos.find((e) => e.estado_novo === 'CHAMADA');
    assert.equal(chamada.usuario_id, atendente.id);
    assert.equal(chamada.guiche_id, guiche.id);
  });
});

describe('concorrência', () => {
  it('atendentes simultâneos recebem senhas diferentes', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG', 'SG', 'SG', 'SG');
    const usuarios = [await ctx.usuario('atendente')];
    for (const nome of ['a2', 'a3', 'a4']) usuarios.push(await ctx.novoAtendente(nome));
    const guiche = await ctx.guiche(1);
    await ctx.repo.criarGuiche({ numero: 4 });
    const guiches = [guiche, await ctx.guiche(2), await ctx.guiche(3), await ctx.guiche(4)];

    const chamadas = await Promise.all(
      usuarios.map((u, i) => ctx.servicos.atendimento.chamarProxima(u, guiches[i].id)),
    );
    const numeros = chamadas.map((c) => c.numero);
    assert.equal(new Set(numeros).size, 4, `senhas repetidas: ${numeros}`);
    assert.deepEqual([...numeros].sort(), [
      '260325-SG001',
      '260325-SG002',
      '260325-SG003',
      '260325-SG004',
    ]);
  });

  it('não há senha repetida nem pulada em 50 emissões simultâneas', async () => {
    const ctx = await criarContexto();
    const tipos = Array.from({ length: 50 }, (_, i) => ['SP', 'SG', 'SE'][i % 3]);
    const emitidas = await Promise.all(tipos.map((t) => ctx.servicos.senhas.emitir(t)));
    const numeros = emitidas.map((s) => s.numero);
    assert.equal(new Set(numeros).size, 50);
    const sgs = numeros.filter((n) => n.includes('-SG')).map((n) => Number(n.slice(-3)));
    assert.deepEqual(sgs.sort((a, b) => a - b), Array.from({ length: sgs.length }, (_, i) => i + 1));
  });

  it('quando só há uma senha, apenas um dos atendentes a recebe', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG');
    const a = await ctx.usuario('atendente');
    const b = await ctx.novoAtendente('b');
    const resultados = await Promise.all([
      ctx.servicos.atendimento.chamarProxima(a, (await ctx.guiche(1)).id),
      ctx.servicos.atendimento.chamarProxima(b, (await ctx.guiche(2)).id),
    ]);
    assert.equal(resultados.filter(Boolean).length, 1);
  });

  it('o mesmo guichê não é ocupado por dois atendentes ao mesmo tempo', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG');
    const a = await ctx.usuario('atendente');
    const b = await ctx.novoAtendente('b');
    const guiche = await ctx.guiche(1);
    const resultados = await Promise.allSettled([
      ctx.servicos.atendimento.chamarProxima(a, guiche.id),
      ctx.servicos.atendimento.chamarProxima(b, guiche.id),
    ]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    const rejeitada = resultados.find((r) => r.status === 'rejected');
    assert.equal(rejeitada.reason.codigo, 'guiche_ocupado');
  });

  it('o mesmo atendente chamando duas vezes seguidas só consegue uma', async () => {
    const ctx = await criarContexto();
    await ctx.emitir('SG', 'SG');
    const a = await ctx.usuario('atendente');
    const guiche = await ctx.guiche(1);
    const resultados = await Promise.allSettled([
      ctx.servicos.atendimento.chamarProxima(a, guiche.id),
      ctx.servicos.atendimento.chamarProxima(a, guiche.id),
    ]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  });
});
