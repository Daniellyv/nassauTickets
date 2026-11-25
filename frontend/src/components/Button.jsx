/** Botão reutilizável: variantes visuais, estado de carregamento e foco visível. */
export default function Button({
  children,
  variante = 'primario',
  carregando = false,
  disabled = false,
  type = 'button',
  className = '',
  ...resto
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variante} ${className}`.trim()}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}
