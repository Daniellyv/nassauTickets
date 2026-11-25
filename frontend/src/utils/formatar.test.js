import { describe, expect, it } from 'vitest';
import { formatarDuracao, numeroCurto, sequencialDe, textoDaChamada } from './formatar.js';

describe('formatar', () => {
  it('extrai a parte curta e o sequencial do número da senha', () => {
    expect(numeroCurto('260325-SG007')).toBe('SG007');
    expect(sequencialDe('260325-SG007')).toBe(7);
    expect(sequencialDe('260325-SP120')).toBe(120);
  });

  it('monta o texto falado da chamada com prioridade, sequencial e guichê', () => {
    expect(textoDaChamada({ tipo: 'SP', numero: '260325-SP003', guiche: 2, ultimaChamada: false })).toBe(
      'Senha prioritária 3. Guichê 2.',
    );
    expect(textoDaChamada({ tipo: 'SE', numero: '260325-SE011', guiche: 1, ultimaChamada: false })).toBe(
      'Senha exames 11. Guichê 1.',
    );
  });

  it('precede com "Última chamada" na segunda chamada', () => {
    expect(textoDaChamada({ tipo: 'SG', numero: '260325-SG010', guiche: 4, ultimaChamada: true })).toBe(
      'Última chamada. Senha geral 10. Guichê 4.',
    );
  });

  it('formata duração em minutos e segundos', () => {
    expect(formatarDuracao(303)).toBe('5min 03s');
    expect(formatarDuracao(60)).toBe('1min 00s');
    expect(formatarDuracao(null)).toBe('—');
  });
});
