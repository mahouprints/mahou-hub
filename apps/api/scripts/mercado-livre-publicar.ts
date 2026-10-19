import 'reflect-metadata';
import type { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { MercadoLivreConfiguracaoSchema } from '@mahou-hub/contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import { PublicacaoJournal } from '../src/modules/mercado-livre/publicacao/publicacao-journal';
import {
  PublicacaoService,
  type RepositorioPublicacao,
} from '../src/modules/mercado-livre/publicacao/publicacao.service';
import {
  custosEfetivosDaVariacao,
  pendenciasComposicaoVariacao,
} from '../src/modules/produtos/custos-variacao';
import { objeto } from '../src/modules/mercado-livre/publicacao/publicacao-verificacao';
import { formatarErroPublicacao } from '../src/modules/mercado-livre/publicacao/publicacao-erro';
import { PacotesService } from '../src/modules/mercado-livre/publicacao/pacotes.service';

const incluirCatalogo = {
  filamento: true,
  filamentos: { include: { filamento: true } },
  variacoes: { include: { filamento: true } },
} satisfies Prisma.ProdutoInclude;

function repositorio(prisma: PrismaService): RepositorioPublicacao {
  return {
    carregar: async (produtoIds) => {
      const produtos = await prisma.produto.findMany({
        where: { id: { in: produtoIds } },
        include: incluirCatalogo,
      });
      return produtos.map((produto) => ({
        id: produto.id,
        ativo: produto.ativo && !produto.rascunho,
        precoCentavos: produto.precoCentavos,
        variacoes: produto.variacoes.map((cor) => {
          const efetivo = custosEfetivosDaVariacao(produto, cor);
          const material = cor.filamento ?? produto.filamentos[0]?.filamento ?? produto.filamento;
          return {
            sku: cor.sku,
            ativo:
              cor.ativo &&
              pendenciasComposicaoVariacao(produto, cor).length === 0 &&
              produto.filamentos.length <= 1,
            precoCentavos: efetivo.precoCentavos,
            pesoG: efetivo.pesoG,
            filamentoId: material.id,
            filamentoAtivo: material.ativo,
            estoqueGramas: Number(material.estoqueGramas),
          };
        }),
      }));
    },
    registrar: async (produtoId, publicacao) => {
      await prisma.$transaction(async (tx) => {
        // Serializa com edição da configuração no ERP para preservar o vínculo recém-gravado.
        await tx.$queryRaw`SELECT id FROM "Produto" WHERE id = ${produtoId} FOR UPDATE`;
        const atual = await tx.produto.findUniqueOrThrow({ where: { id: produtoId } });
        const mercadoLivre = MercadoLivreConfiguracaoSchema.parse({
          ...objeto(atual.mercadoLivre),
          publicacao,
        });
        const concluido = publicacao.status === 'concluido';
        await tx.produto.update({
          where: { id: produtoId },
          data: {
            mercadoLivre: mercadoLivre as Prisma.InputJsonObject,
            ...(concluido
              ? {
                  anunciado: true,
                  canaisAnunciados: [...new Set([...atual.canaisAnunciados, 'ML' as const])],
                }
              : {}),
          },
        });
      });
    },
  };
}

/** Decodifica UTF-8 entre chunks; ex.: um nome com ã dividido em dois buffers. */
export async function entradaStdin(entrada: Readable = process.stdin): Promise<unknown> {
  entrada.setEncoding('utf8');
  let texto = '';
  for await (const parte of entrada) {
    texto += String(parte);
    if (Buffer.byteLength(texto) > 2_000_000) throw new Error('Entrada ultrapassa o limite.');
  }
  return JSON.parse(texto) as unknown;
}

async function executar(): Promise<void> {
  const entrada = await entradaStdin();
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const config = new ConfigService();
    const http = new MercadoLivreHttpService(config, prisma);
    if (['inspecionar_pacotes', 'corrigir_pacotes'].includes(String(objeto(entrada).modo))) {
      const pacotes = new PacotesService(http, {
        carregar: async (ids) => {
          const produtos = await prisma.produto.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              ativo: true,
              rascunho: true,
              precoCentavos: true,
              pesoG: true,
              mercadoLivre: true,
              variacoes: { select: { sku: true, ativo: true, precoCentavos: true, pesoG: true } },
            },
          });
          return produtos.map((produto) => ({
            ...produto,
            pesoG: Number(produto.pesoG),
            variacoes: produto.variacoes.map((cor) => ({
              ...cor,
              pesoG: cor.pesoG === null ? null : Number(cor.pesoG),
            })),
          }));
        },
      });
      process.stdout.write(`${JSON.stringify(await pacotes.executar(entrada))}\n`);
      return;
    }
    const journal = new PublicacaoJournal(
      config.get<string>('ML_PUBLICACAO_STORAGE_DIR') ?? '/app/private',
      http.sellerId,
    );
    const servico = new PublicacaoService(http, repositorio(prisma), journal);
    const resultado =
      objeto(entrada).modo === 'inspecionar'
        ? await servico.inspecionar(entrada)
        : await servico.executar(entrada);
    process.stdout.write(`${JSON.stringify(resultado)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void executar().catch((erro: unknown) => {
    process.stderr.write(`${JSON.stringify(formatarErroPublicacao(erro))}\n`);
    process.exitCode = 1;
  });
}
