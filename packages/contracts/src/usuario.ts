import { z } from 'zod';

// ADMIN = acesso total. VISUALIZADOR = somente leitura (bloqueado em qualquer mutação).
export const PapelEnum = z.enum(['ADMIN', 'VISUALIZADOR']);

// Default VISUALIZADOR (menor privilégio): criar usuário por engano não vira admin.
export const UsuarioCreateSchema = z
  .object({
    nome: z.string().min(1).optional(),
    login: z.string().min(1).optional(),
    email: z.string().email().optional(),
    senha: z.string().min(8),
    papel: PapelEnum.default('VISUALIZADOR'),
  })
  .refine((v) => Boolean(v.login || v.email), {
    message: 'Informe login ou e-mail (pelo menos um) pra poder autenticar',
    path: ['login'],
  });

export const TrocarSenhaSchema = z.object({
  senha: z.string().min(8),
});

// Forma pública do usuário (NUNCA inclui senhaHash).
export const UsuarioPublicoSchema = z.object({
  id: z.string(),
  nome: z.string().nullable(),
  login: z.string().nullable(),
  email: z.string().nullable(),
  papel: PapelEnum,
  criadoEm: z.coerce.date(),
});

export type Papel = z.infer<typeof PapelEnum>;
export type UsuarioCreate = z.infer<typeof UsuarioCreateSchema>;
export type TrocarSenha = z.infer<typeof TrocarSenhaSchema>;
export type UsuarioPublico = z.infer<typeof UsuarioPublicoSchema>;
