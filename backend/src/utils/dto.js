import { paraIso } from './tempo.js';
import { rotuloEstado } from '../domain/estados.js';

/** Converte uma linha de senha (snake_case do repositório) para o JSON da API. */
export function senhaParaDto(linha) {
  if (!linha) return null;
  return {
    id: Number(linha.id),
    numero: linha.numero,
    tipo: linha.tipo,
    estado: linha.estado,
    estadoRotulo: rotuloEstado(linha.estado),
    emitidaEm: paraIso(linha.emitida_em),
    guiche: linha.guiche_numero ?? null,
    atendente: linha.atendente_nome ?? null,
    numChamadas: Number(linha.num_chamadas ?? 0),
    primeiraChamadaEm: paraIso(linha.primeira_chamada_em),
    segundaChamadaEm: paraIso(linha.segunda_chamada_em),
    ultimaChamadaEm: paraIso(linha.ultima_chamada_em),
    inicioAtendimentoEm: paraIso(linha.inicio_atendimento_em),
    fimAtendimentoEm: paraIso(linha.fim_atendimento_em),
  };
}

export function usuarioParaDto(linha) {
  if (!linha) return null;
  return {
    id: Number(linha.id),
    nome: linha.nome,
    usuario: linha.username,
    perfil: linha.perfil,
    ativo: Boolean(linha.ativo),
  };
}

export function guicheParaDto(linha) {
  if (!linha) return null;
  return { id: Number(linha.id), numero: Number(linha.numero), ativo: Boolean(linha.ativo) };
}
