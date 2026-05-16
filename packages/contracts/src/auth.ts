import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8),
});

export const LoginOutputSchema = z.object({
  usuarioId: z.string(),
  email: z.string().email(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type LoginOutput = z.infer<typeof LoginOutputSchema>;
