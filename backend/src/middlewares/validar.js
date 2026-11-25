import { z } from 'zod';
import { ErroApp } from '../utils/erros.js';

/**
 * Valida req.body / req.params / req.query com zod e entrega o resultado em
 * req.dados[origem]. Entradas inesperadas são rejeitadas com 400.
 */
export function validar(origem, schema) {
  return (req, _res, next) => {
    const resultado = schema.safeParse(req[origem] ?? {});
    if (!resultado.success) {
      const detalhes = resultado.error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensagem: i.message,
      }));
      const erro = new ErroApp(400, 'dados_invalidos', 'Dados inválidos.');
      erro.detalhes = detalhes;
      throw erro;
    }
    req.dados = { ...(req.dados ?? {}), [origem]: resultado.data };
    next();
  };
}

export const schemas = {
  emitirSenha: z.object({ tipo: z.enum(['SP', 'SG', 'SE']) }).strict(),
  login: z
    .object({
      usuario: z.string().trim().min(1).max(50),
      senha: z.string().min(1).max(100),
    })
    .strict(),
  idNaRota: z.object({ id: z.coerce.number().int().positive() }),
  chamarProxima: z.object({ guicheId: z.coerce.number().int().positive() }).strict(),
  novoUsuario: z
    .object({
      nome: z.string().trim().min(3).max(120),
      usuario: z
        .string()
        .trim()
        .min(3)
        .max(50)
        .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, hífen e sublinhado.'),
      senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(100),
      perfil: z.enum(['ATENDENTE', 'GESTOR']),
    })
    .strict(),
  atualizarUsuario: z
    .object({
      nome: z.string().trim().min(3).max(120).optional(),
      senha: z.string().min(8).max(100).optional(),
      perfil: z.enum(['ATENDENTE', 'GESTOR']).optional(),
      ativo: z.boolean().optional(),
    })
    .strict(),
  novoGuiche: z.object({ numero: z.coerce.number().int().min(1).max(99) }).strict(),
  atualizarGuiche: z.object({ ativo: z.boolean() }).strict(),
  periodo: z.object({
    data: z.string().optional(),
    mes: z.string().optional(),
    formato: z.enum(['json', 'csv']).optional(),
  }),
};
