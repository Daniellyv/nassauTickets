import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling.js';

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('consulta de tempos em tempos e guarda os dados', async () => {
    const buscar = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
    const { result } = renderHook(() => usePolling(buscar, { intervaloMs: 1000 }));

    await act(async () => {});
    expect(result.current.dados).toEqual({ n: 1 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.dados).toEqual({ n: 2 });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('mantém os últimos dados quando falha, aumenta o intervalo e se recupera sozinho', async () => {
    const buscar = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockRejectedValueOnce(new Error('caiu'))
      .mockRejectedValueOnce(new Error('caiu'))
      .mockResolvedValue({ n: 3 });
    const { result } = renderHook(() =>
      usePolling(buscar, { intervaloMs: 1000, intervaloMaximoMs: 8000 }),
    );

    await act(async () => {});
    expect(result.current.dados).toEqual({ n: 1 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // 2ª chamada falha
    });
    expect(result.current.erro).toBeTruthy();
    expect(result.current.dados).toEqual({ n: 1 }); // dados antigos continuam

    // backoff: próxima tentativa só após 2 s (1000 * 2^1), não após 1 s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(buscar).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // 3ª chamada falha
    });
    expect(buscar).toHaveBeenCalledTimes(3);

    // próxima espera: 4 s; depois disso recupera
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.current.erro).toBeNull();
    expect(result.current.dados).toEqual({ n: 3 });
  });

  it('usa o cache local como dado inicial (painel offline)', () => {
    localStorage.setItem('chave', JSON.stringify({ dados: { n: 99 }, em: '2026-03-25T13:00:00.000Z' }));
    const buscar = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePolling(buscar, { chaveCache: 'chave' }));
    expect(result.current.dados).toEqual({ n: 99 });
    expect(result.current.atualizadoEm).toEqual(new Date('2026-03-25T13:00:00.000Z'));
  });
});
