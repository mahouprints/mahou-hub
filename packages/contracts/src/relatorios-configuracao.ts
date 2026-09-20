import { z } from 'zod';

export const WebhookGoogleSchema = z
  .string()
  .regex(
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/,
    'Use a URL de implantação do Google Apps Script terminada em /exec',
  );
export const ConfiguracaoRelatoriosUpdateSchema = z
  .object({
    emailGoogle: z
      .string()
      .trim()
      .email()
      .transform((v) => v.toLowerCase()),
    destinatarios: z
      .array(
        z
          .string()
          .trim()
          .email()
          .transform((v) => v.toLowerCase()),
      )
      .min(1)
      .max(10)
      .transform((v) => [...new Set(v)].sort()),
    webhookUrl: WebhookGoogleSchema.nullable().optional(),
    ativo: z.boolean(),
  })
  .strict();
export type ConfiguracaoRelatoriosUpdate = z.infer<typeof ConfiguracaoRelatoriosUpdateSchema>;
