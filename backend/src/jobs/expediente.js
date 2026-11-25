/**
 * Descarta as senhas que sobraram quando o expediente termina (ou de dias anteriores).
 * Roda de tempos em tempos; é idempotente e não impede o encerramento do processo.
 */
export function iniciarJobExpediente({ atendimento, intervaloMs = 30_000, log = console }) {
  const executar = async () => {
    try {
      const descartadas = await atendimento.descartarSobras();
      if (descartadas > 0) log.info(`[expediente] ${descartadas} senha(s) descartada(s).`);
    } catch (erro) {
      log.error('[expediente] falha ao descartar senhas:', erro.code ?? erro.message);
    }
  };
  executar();
  const timer = setInterval(executar, intervaloMs);
  timer.unref();
  return () => clearInterval(timer);
}
