import { env } from '../config/env.js';
import { criarAtendimentoService } from './atendimentoService.js';
import { criarAuthService } from './authService.js';
import { criarCadastroService } from './cadastroService.js';
import { criarExpedienteService } from './expedienteService.js';
import { criarPainelService } from './painelService.js';
import { criarRelatorioService } from './relatorioService.js';
import { criarSenhaService } from './senhaService.js';

/**
 * Monta todos os serviços a partir de um repositório e de um relógio.
 * O relógio injetável permite testes e simulações com tempo controlado.
 */
export function criarServicos({ repo, relogio = () => new Date(), config = env }) {
  const expediente = criarExpedienteService(config.expediente);
  const base = { repo, relogio, expediente };
  return {
    repo,
    relogio,
    expediente,
    auth: criarAuthService({ repo, config }),
    senhas: criarSenhaService(base),
    atendimento: criarAtendimentoService(base),
    painel: criarPainelService(base),
    cadastros: criarCadastroService({ repo }),
    relatorios: criarRelatorioService({ repo, relogio }),
  };
}
