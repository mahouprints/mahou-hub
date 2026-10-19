import { HttpException } from '@nestjs/common';
import { ZodError } from 'zod';
import { contextoErroPublicacao } from '../mercado-livre-http.service';

/** Falha com mensagem local segura para a CLI; nunca recebe corpo de erro externo. */
export class PublicacaoErro extends Error {
  chave?: string;
}

/** Exibe mensagens próprias e códigos sanitizados, ocultando ORM, tokens e respostas cruas. */
export function formatarErroPublicacao(erro: unknown): Record<string, unknown> {
  if (erro instanceof ZodError)
    return {
      erro: 'Entrada inválida.',
      campos: erro.issues.map((item) => ({ caminho: item.path, codigo: item.code })),
    };
  const resultado: Record<string, unknown> = {
    erro: 'Operação interrompida. Preserve execucaoId e consulte o journal privado antes de retomar.',
  };
  if (erro instanceof PublicacaoErro)
    return { ...resultado, motivo: erro.message, ...(erro.chave ? { chave: erro.chave } : {}) };
  if (!(erro instanceof HttpException)) return resultado;
  const resposta = erro.getResponse();
  if (typeof resposta !== 'object') return resultado;
  const campos = resposta as Record<string, unknown>;
  return {
    ...resultado,
    mercadoLivreStatus: campos.mercadoLivreStatus ?? null,
    ...contextoErroPublicacao(campos.mercadoLivreOperacao, campos.mercadoLivreCaminho),
    ...(campos.mercadoLivreCausas ? { mercadoLivreCausas: campos.mercadoLivreCausas } : {}),
    ...(campos.publicacaoChave ? { chave: campos.publicacaoChave } : {}),
  };
}
