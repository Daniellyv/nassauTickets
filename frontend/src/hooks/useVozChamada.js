import { useCallback, useMemo } from 'react';

/**
 * Leitura em voz alta das chamadas com a Web Speech API (pt-BR).
 * Navegadores só liberam áudio depois de um clique do usuário; por isso o painel
 * oferece o botão "Ativar áudio", que chama `falar` uma vez para destravar.
 */
export function useVozChamada() {
  const suportado = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    [],
  );

  const falar = useCallback(
    (texto) => {
      if (!suportado) return;
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = 'pt-BR';
      fala.rate = 0.9;
      window.speechSynthesis.speak(fala);
    },
    [suportado],
  );

  const cancelar = useCallback(() => {
    if (suportado) window.speechSynthesis.cancel();
  }, [suportado]);

  return { suportado, falar, cancelar };
}
