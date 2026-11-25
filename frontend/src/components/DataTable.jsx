/**
 * Tabela acessível e reutilizável.
 * colunas: [{ chave, titulo, render?(linha) }]
 */
export default function DataTable({ legenda, colunas, linhas, vazio = 'Nenhum registro.', chaveLinha }) {
  return (
    <div className="tabela-rolagem" tabIndex={0} role="region" aria-label={legenda}>
      <table className="tabela">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length} className="tabela-vazia">
                {vazio}
              </td>
            </tr>
          ) : (
            linhas.map((linha, indice) => (
              <tr key={chaveLinha ? chaveLinha(linha) : (linha.id ?? indice)}>
                {colunas.map((c) => (
                  <td key={c.chave}>{c.render ? c.render(linha) : (linha[c.chave] ?? '')}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
