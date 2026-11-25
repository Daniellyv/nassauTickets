import { useCallback, useEffect, useRef, useState } from 'react';

function lerCache(chave) {
  if (!chave) return null;
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const { dados, em } = JSON.parse(bruto);
    return { dados, atualizadoEm: new Date(em) };
  } catch {
    return null;
  }
}

function gravarCache(chave, dados) {
  if (!chave) return;
  try {
    localStorage.setItem(chave, JSON.stringify({ dados, em: new Date().toISOString() }));
  } catch {
    // armazenamento indisponível: segue sem cache
  }
}

/**
 * Consulta uma função assíncrona repetidamente.
 *  - Em caso de falha, aumenta o intervalo (backoff) até `intervaloMaximoMs`
 *    e mantém os últimos dados conhecidos (do cache local, se `chaveCache` for informada).
 *  - Ao voltar a funcionar, retoma o intervalo normal sozinho.
 */
export function usePolling(buscar, { intervaloMs = 3000, intervaloMaximoMs = 15000, chaveCache } = {}) {
  const [estado, setEstado] = useState(() => {
    const cache = lerCache(chaveCache);
    return {
      dados: cache?.dados ?? null,
      atualizadoEm: cache?.atualizadoEm ?? null,
      erro: null,
      carregando: true,
    };
  });
  const buscarRef = useRef(buscar);
  const cicloRef = useRef(null);

  useEffect(() => {
    buscarRef.current = buscar;
  });

  useEffect(() => {
    let cancelado = false;
    let timer;
    let falhas = 0;

    async function ciclo() {
      clearTimeout(timer);
      try {
        const dados = await buscarRef.current();
        if (cancelado) return;
        falhas = 0;
        gravarCache(chaveCache, dados);
        setEstado({ dados, atualizadoEm: new Date(), erro: null, carregando: false });
      } catch (erro) {
        if (cancelado) return;
        falhas += 1;
        setEstado((anterior) => ({ ...anterior, erro, carregando: false }));
      }
      if (!cancelado) {
        const espera = falhas === 0 ? intervaloMs : Math.min(intervaloMs * 2 ** falhas, intervaloMaximoMs);
        timer = setTimeout(ciclo, espera);
      }
    }

    cicloRef.current = ciclo;
    ciclo();
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [intervaloMs, intervaloMaximoMs, chaveCache]);

  /** Força uma consulta imediata (ex.: depois de uma ação do usuário). */
  const recarregar = useCallback(() => cicloRef.current?.(), []);

  return { ...estado, recarregar };
}
