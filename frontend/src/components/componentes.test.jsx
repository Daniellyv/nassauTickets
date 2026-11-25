import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErroApi } from '../services/http.js';
import DataTable from './DataTable.jsx';
import StatusBanner from './StatusBanner.jsx';
import TicketBadge from './TicketBadge.jsx';

describe('TicketBadge', () => {
  it('mostra a sigla e o nome acessível do tipo (não depende só da cor)', () => {
    render(<TicketBadge tipo="SP" />);
    expect(screen.getByText('Prioritária')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
  });
});

describe('StatusBanner', () => {
  it('não aparece sem erro', () => {
    const { container } = render(<StatusBanner erro={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('avisa a indisponibilidade e até quando os dados são confiáveis', () => {
    const erro = new ErroApi(0, 'sem_conexao', 'Sem conexão com o servidor.');
    render(<StatusBanner erro={erro} atualizadoEm={new Date('2026-03-25T13:05:00Z')} rotuloDados="chamadas" />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Sistema indisponível — reconectando…');
    expect(alerta).toHaveTextContent('Exibindo chamadas de 10:05');
  });

  it('ignora erros de negócio (4xx): só falhas de disponibilidade geram o aviso', () => {
    const erro = new ErroApi(409, 'conflito', 'Conflito.');
    const { container } = render(<StatusBanner erro={erro} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DataTable', () => {
  const colunas = [
    { chave: 'nome', titulo: 'Nome' },
    { chave: 'valor', titulo: 'Valor', render: (l) => `R$ ${l.valor}` },
  ];

  it('renderiza cabeçalhos e linhas', () => {
    render(<DataTable legenda="Teste" colunas={colunas} linhas={[{ id: 1, nome: 'A', valor: 10 }]} />);
    expect(screen.getByRole('columnheader', { name: 'Valor' })).toBeInTheDocument();
    expect(screen.getByText('R$ 10')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há linhas', () => {
    render(<DataTable legenda="Teste" colunas={colunas} linhas={[]} vazio="Nada por aqui." />);
    expect(screen.getByText('Nada por aqui.')).toBeInTheDocument();
  });
});
