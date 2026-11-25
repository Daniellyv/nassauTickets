import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api.js';
import { ErroApi } from '../services/http.js';
import Painel from './Painel.jsx';
import Totem from './Totem.jsx';

vi.mock('../services/api.js', () => ({
  api: { health: vi.fn(), emitirSenha: vi.fn(), painel: vi.fn() },
}));

const SENHA = {
  id: 1,
  numero: '260325-SG001',
  tipo: 'SG',
  estado: 'AGUARDANDO',
  emitidaEm: '2026-03-25T13:00:00.000Z',
  aguardandoNaFrente: 2,
};

const renderizar = (pagina) => render(<MemoryRouter>{pagina}</MemoryRouter>);

describe('Totem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.health.mockResolvedValue({ status: 'ok' });
  });

  it('emite a senha escolhida e mostra o número ao cliente', async () => {
    api.emitirSenha.mockResolvedValue({ senha: SENHA });
    renderizar(<Totem />);

    await userEvent.click(screen.getByRole('button', { name: /Geral/ }));

    expect(api.emitirSenha).toHaveBeenCalledWith('SG');
    expect(await screen.findByText('SG001')).toBeInTheDocument();
    expect(screen.getByText(/Aguarde ser chamado no painel/)).toBeInTheDocument();
    expect(screen.getByText('260325-SG001', { exact: false })).toBeInTheDocument();
  });

  it('mostra a mensagem do servidor fora do expediente', async () => {
    api.emitirSenha.mockRejectedValue(
      new ErroApi(403, 'fora_do_expediente', 'Fora do expediente de atendimento (07:00 às 17:00).'),
    );
    renderizar(<Totem />);

    await userEvent.click(screen.getByRole('button', { name: /Prioritária/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Fora do expediente');
  });

  it('desabilita a emissão e orienta o cliente quando o sistema está indisponível', async () => {
    api.health.mockRejectedValue(new ErroApi(0, 'sem_conexao', 'Sem conexão com o servidor.'));
    renderizar(<Totem />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Geral/ })).toBeDisabled());
    expect(screen.getByText(/Procure a recepção/)).toBeInTheDocument();
  });

  it('não pede nenhum dado pessoal (LGPD)', () => {
    renderizar(<Totem />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum dado pessoal é solicitado/)).toBeInTheDocument();
  });
});

describe('Painel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const chamada = (id, numero, tipo, guiche, extra = {}) => ({
    id,
    numero,
    tipo,
    guiche,
    numChamadas: 1,
    ultimaChamada: false,
    chamadaEm: `2026-03-25T13:0${id}:00.000Z`,
    ...extra,
  });

  it('destaca a chamada atual e lista as anteriores com o guichê', async () => {
    api.painel.mockResolvedValue({
      expedienteAberto: true,
      chamadas: [
        chamada(3, '260325-SP002', 'SP', 2),
        chamada(2, '260325-SG004', 'SG', 1),
        chamada(1, '260325-SE001', 'SE', 3),
      ],
    });
    renderizar(<Painel />);

    const atual = await screen.findByRole('status', { name: 'Chamada atual' });
    expect(atual).toHaveTextContent('SP002');
    expect(atual).toHaveTextContent('Guichê 2');
    const anteriores = screen.getByRole('region', { name: 'Chamadas anteriores' });
    expect(anteriores).toHaveTextContent('SG004');
    expect(anteriores).toHaveTextContent('SE001');
  });

  it('indica "Última chamada" na segunda chamada', async () => {
    api.painel.mockResolvedValue({
      expedienteAberto: true,
      chamadas: [chamada(1, '260325-SG001', 'SG', 1, { numChamadas: 2, ultimaChamada: true })],
    });
    renderizar(<Painel />);
    expect(await screen.findByText('Última chamada')).toBeInTheDocument();
  });

  it('com o backend fora do ar, continua mostrando a última lista conhecida e avisa', async () => {
    localStorage.setItem(
      'nt.painel',
      JSON.stringify({
        dados: { expedienteAberto: true, chamadas: [chamada(1, '260325-SG009', 'SG', 4)] },
        em: '2026-03-25T13:10:00.000Z',
      }),
    );
    api.painel.mockRejectedValue(new ErroApi(503, 'servico_indisponivel', 'Indisponível.'));
    renderizar(<Painel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sistema indisponível — reconectando…');
    expect(screen.getByRole('status', { name: 'Chamada atual' })).toHaveTextContent('SG009');
  });

  it('mostra "Atendimento encerrado" fora do expediente sem chamadas', async () => {
    api.painel.mockResolvedValue({ expedienteAberto: false, chamadas: [] });
    renderizar(<Painel />);
    expect(await screen.findByText('Atendimento encerrado')).toBeInTheDocument();
  });
});
