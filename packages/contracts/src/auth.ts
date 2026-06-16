import { z } from 'zod';

// `email` aceita e-mail OU username (ex.: "roniberger") — o campo mantém o nome
// por compat com o front; o service casa por email OU login.
export const LoginInputSchema = z.object({
  email: z.string().min(1),
  senha: z.string().min(8),
});

export const LoginOutputSchema = z.object({
  usuarioId: z.string(),
  email: z.string(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type LoginOutput = z.infer<typeof LoginOutputSchema>;

/**
 * Gera JWT de longa duração pra uso em fluxos automáticos (n8n, scripts).
 * O token é mostrado uma única vez — usuário copia e cola no .env do consumer.
 * Carrega o mesmo payload (sub/email) do login normal, então funciona em
 * todos os endpoints protegidos.
 */
export const ApiTokenInputSchema = z.object({
  ttlDias: z.number().int().min(1).max(365).default(90),
});

export const ApiTokenOutputSchema = z.object({
  token: z.string(),
  expiraEm: z.coerce.date(),
});

export type ApiTokenInput = z.infer<typeof ApiTokenInputSchema>;
export type ApiTokenOutput = z.infer<typeof ApiTokenOutputSchema>;
