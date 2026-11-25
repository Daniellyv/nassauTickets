import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESTADOS, podeTransitar, rotuloEstado, transicoesDe } from '../src/domain/estados.js';
import { escolherProximoTipo } from '../src/domain/prioridade.js';
import { formatarNumero } from '../src/services/senhaService.js';

const cheias = { SP: 3, SE: 3, SG: 3 };

describe('escolherProximoTipo (regra de priorização)', () => {
  it('retorna null quando todas as filas estão vazias', () => {
    assert.equal(escolherProximoTipo(null, { SP: 0, SE: 0, SG: 0 }), null);
    assert.equal(escolherProximoTipo('SP', {}), null);
  });

  it('começa o dia pela senha prioritária', () => {
    assert.equal(escolherProximoTipo(null, cheias), 'SP');
  });

  it('segue o ciclo SP -> SE -> SP -> SE... com todas as filas cheias', () => {
    assert.equal(escolherProximoTipo('SP', cheias), 'SE');
    assert.equal(escolherProximoTipo('SE', cheias), 'SP');
    assert.equal(escolherProximoTipo('SG', cheias), 'SP');
  });

  it('após SP vem SE antes de SG', () => {
    assert.equal(escolherProximoTipo('SP', { SP: 1, SE: 1, SG: 1 }), 'SE');
  });

  it('após SP, sem SE, chama SG', () => {
    assert.equal(escolherProximoTipo('SP', { SP: 5, SE: 0, SG: 2 }), 'SG');
  });

  it('após SP, sem SE nem SG, repete SP (única opção)', () => {
    assert.equal(escolherProximoTipo('SP', { SP: 2, SE: 0, SG: 0 }), 'SP');
  });

  it('sem SP na fila, alterna SE e SG para não repetir o tipo anterior', () => {
    assert.equal(escolherProximoTipo('SE', { SP: 0, SE: 4, SG: 4 }), 'SG');
    assert.equal(escolherProximoTipo('SG', { SP: 0, SE: 4, SG: 4 }), 'SE');
  });

  it('repete o tipo quando é a única fila com senhas', () => {
    assert.equal(escolherProximoTipo('SG', { SP: 0, SE: 0, SG: 9 }), 'SG');
    assert.equal(escolherProximoTipo('SE', { SP: 0, SE: 9, SG: 0 }), 'SE');
  });

  it('aceita booleanos como indicação de fila não vazia', () => {
    assert.equal(escolherProximoTipo(null, { SP: false, SE: true, SG: true }), 'SE');
  });

  it('nunca retorna o mesmo tipo da última chamada quando há alternativa', () => {
    const tipos = [null, 'SP', 'SE', 'SG'];
    const combinacoes = [];
    for (let m = 1; m < 8; m += 1) {
      combinacoes.push({ SP: m & 1, SE: (m >> 1) & 1, SG: (m >> 2) & 1 });
    }
    for (const ultimo of tipos) {
      for (const filas of combinacoes) {
        const escolhido = escolherProximoTipo(ultimo, filas);
        assert.ok(escolhido, `deveria escolher algo para ${ultimo} / ${JSON.stringify(filas)}`);
        assert.ok(filas[escolhido], 'o tipo escolhido precisa ter senha na fila');
        const alternativas = Object.keys(filas).filter((t) => filas[t] && t !== ultimo);
        if (alternativas.length > 0) assert.notEqual(escolhido, ultimo);
      }
    }
  });
});

describe('máquina de estados', () => {
  it('permite o fluxo completo EMITIDA -> ... -> ATENDIDA', () => {
    const caminho = [
      ESTADOS.EMITIDA,
      ESTADOS.AGUARDANDO,
      ESTADOS.CHAMADA,
      ESTADOS.CHAMADA_NOVAMENTE,
      ESTADOS.EM_ATENDIMENTO,
      ESTADOS.ATENDIDA,
    ];
    for (let i = 0; i < caminho.length - 1; i += 1) {
      assert.ok(podeTransitar(caminho[i], caminho[i + 1]), `${caminho[i]} -> ${caminho[i + 1]}`);
    }
  });

  it('permite atender já na primeira chamada', () => {
    assert.ok(podeTransitar(ESTADOS.CHAMADA, ESTADOS.EM_ATENDIMENTO));
  });

  it('só permite NAO_COMPARECEU depois da segunda chamada', () => {
    assert.ok(podeTransitar(ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.NAO_COMPARECEU));
    assert.equal(podeTransitar(ESTADOS.CHAMADA, ESTADOS.NAO_COMPARECEU), false);
    assert.equal(podeTransitar(ESTADOS.AGUARDANDO, ESTADOS.NAO_COMPARECEU), false);
  });

  it('rejeita saltos e retrocessos', () => {
    assert.equal(podeTransitar(ESTADOS.AGUARDANDO, ESTADOS.EM_ATENDIMENTO), false);
    assert.equal(podeTransitar(ESTADOS.CHAMADA, ESTADOS.AGUARDANDO), false);
    assert.equal(podeTransitar(ESTADOS.EM_ATENDIMENTO, ESTADOS.CHAMADA), false);
    assert.equal(podeTransitar(ESTADOS.EM_ATENDIMENTO, ESTADOS.NAO_COMPARECEU), false);
  });

  it('estados finais não têm saída', () => {
    for (const final of [ESTADOS.ATENDIDA, ESTADOS.NAO_COMPARECEU, ESTADOS.DESCARTADA]) {
      assert.deepEqual(transicoesDe(final), []);
    }
  });

  it('exibe NÃO_COMPARECEU com acento', () => {
    assert.equal(rotuloEstado(ESTADOS.NAO_COMPARECEU), 'NÃO_COMPARECEU');
    assert.equal(rotuloEstado(ESTADOS.ATENDIDA), 'ATENDIDA');
  });
});

describe('numeração da senha (YYMMDD-PPSQ)', () => {
  it('formata ano com 2 dígitos, tipo e sequência com 3 dígitos', () => {
    assert.equal(formatarNumero('2026-03-25', 'SP', 1), '260325-SP001');
    assert.equal(formatarNumero('2026-12-01', 'SG', 42), '261201-SG042');
    assert.equal(formatarNumero('2027-01-09', 'SE', 999), '270109-SE999');
  });
});
