import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { casarComCadastro } from './casar-item-cadastro';
import { GeminiClient, type ArquivoParaLeitura } from './gemini.client';
import { PROMPT_EXTRACAO_RECIBO, SCHEMA_EXTRACAO_RECIBO } from './extracao-recibo.prompt';

/**
 * Espelho em Zod do que a API deve devolver. O `response_format` do Gemini garante o
 * formato; isto garante o conteúdo — e é a rede que segura mudança de comportamento do
 * modelo sem aviso.
 */
const ItemLidoSchema = z.object({
  descricaoNota: z.string().min(1),
  quantidade: z.number().positive().nullish(),
  unidade: z.string().min(1).nullish(),
  valorUnitario: z.number().nonnegative().nullish(),
  valorTotal: z.number().nonnegative().nullish(),
  tipo: z.enum(['FILAMENTO', 'INSUMO', 'NAO_ESTOCAVEL']).nullish(),
  gramasTotal: z.number().int().positive().nullish(),
  categoriaCusto: z.enum(['SOFTWARE', 'MARKETING', 'INSUMOS', 'OUTROS']).nullish(),
  camposIlegiveis: z.array(z.string()).default([]),
});

const NotaLidaSchema = z.object({
  fornecedor: z.string().min(1).nullish(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser AAAA-MM-DD').nullish(),
  valorTotal: z.number().nonnegative().nullish(),
  camposIlegiveis: z.array(z.string()).default([]),
  itens: z.array(ItemLidoSchema).default([]),
});

type ItemLido = z.infer<typeof ItemLidoSchema>;

/** Foto de nota tirada de perto passa fácil de 20MB; PDF de nota, nunca. */
const MIMES_LEGIVEIS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

@Injectable()
export class ExtracaoReciboService {
  private readonly storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiClient,
    config: ConfigService,
  ) {
    this.storageDir = config.get<string>('STORAGE_DIR') ?? './storage';
  }

  /**
   * Lê os anexos do recibo, grava o que foi extraído e devolve o recibo atualizado.
   * Reextrair descarta a leitura anterior — desde que ninguém tenha confirmado ainda.
   */
  async extrair(reciboId: string) {
    const recibo = await this.prisma.recibo.findUnique({
      where: { id: reciboId },
      include: { arquivos: true },
    });
    if (!recibo) throw new NotFoundException(`Recibo ${reciboId} não existe`);
    if (recibo.status === 'CONFIRMADO') {
      throw new BadRequestException(
        'Recibo já confirmado — os movimentos de estoque já foram lançados, reler agora não muda nada',
      );
    }

    const arquivos = await this.carregarArquivos(recibo.arquivos);
    const bruto = await this.gemini.lerJson({
      arquivos,
      prompt: PROMPT_EXTRACAO_RECIBO,
      schema: SCHEMA_EXTRACAO_RECIBO,
    });
    const nota = NotaLidaSchema.parse(bruto);

    return this.gravar(reciboId, nota);
  }

  private async carregarArquivos(
    anexos: Array<{ arquivo: string; mimeType: string; nomeOriginal: string }>,
  ): Promise<ArquivoParaLeitura[]> {
    const legiveis = anexos.filter((a) => MIMES_LEGIVEIS.has(a.mimeType));
    if (legiveis.length === 0) {
      throw new BadRequestException(
        'Nenhum arquivo legível anexado — envie a foto (JPG/PNG/HEIC) ou o PDF da nota',
      );
    }
    return Promise.all(
      legiveis.map(async (a) => ({
        base64: (await fs.readFile(join(this.storageDir, a.arquivo))).toString('base64'),
        mimeType: a.mimeType,
      })),
    );
  }

  private async gravar(reciboId: string, nota: z.infer<typeof NotaLidaSchema>) {
    const [filamentos, insumos] = await Promise.all([
      this.prisma.filamento.findMany({ where: { ativo: true }, select: { id: true, nome: true } }),
      this.prisma.insumo.findMany({ where: { ativo: true }, select: { id: true, nome: true } }),
    ]);

    const itens = nota.itens.map((item) => this.prepararItem(item, filamentos, insumos));

    return this.prisma.$transaction(async (tx) => {
      // Releitura substitui a anterior por inteiro: item meio-editado de uma leitura
      // antiga misturado com a nova é pior que recomeçar.
      await tx.reciboItem.deleteMany({ where: { reciboId } });
      await tx.recibo.update({
        where: { id: reciboId },
        data: {
          fornecedor: nota.fornecedor ?? null,
          data: nota.data ? new Date(`${nota.data}T12:00:00.000Z`) : undefined,
          valorCentavos: emCentavos(nota.valorTotal),
          camposIlegiveis: alertasDaNota(nota),
          status: 'EXTRAIDO',
          extraidoEm: new Date(),
          itens: { create: itens },
        },
      });
      return tx.recibo.findUniqueOrThrow({
        where: { id: reciboId },
        include: { arquivos: { orderBy: { criadoEm: 'asc' } }, itens: { orderBy: { criadoEm: 'asc' } } },
      });
    });
  }

  /**
   * Converte a linha lida no que vai pro banco: valores em centavos, o derivado que dá
   * pra calcular sem ambiguidade, e o vínculo com o cadastro quando o nome bate.
   */
  private prepararItem(
    item: ItemLido,
    filamentos: Array<{ id: string; nome: string }>,
    insumos: Array<{ id: string; nome: string }>,
  ) {
    const { unitCentavos, totalCentavos } = completarValores(item);
    const cadastro = this.vincular(item, filamentos, insumos);

    return {
      descricaoNota: item.descricaoNota,
      quantidade: item.quantidade ?? null,
      unidade: item.unidade ?? null,
      valorUnitCentavos: unitCentavos,
      valorTotalCentavos: totalCentavos,
      tipo: item.tipo ?? null,
      categoriaCusto: item.tipo === 'NAO_ESTOCAVEL' ? (item.categoriaCusto ?? 'OUTROS') : null,
      gramasTotal: item.gramasTotal ?? null,
      camposIlegiveis: alertasDoItem(item, totalCentavos),
      ...cadastro,
    };
  }

  private vincular(
    item: ItemLido,
    filamentos: Array<{ id: string; nome: string }>,
    insumos: Array<{ id: string; nome: string }>,
  ) {
    if (item.tipo === 'FILAMENTO') {
      return { filamentoId: casarComCadastro(item.descricaoNota, filamentos), insumoId: null };
    }
    if (item.tipo === 'INSUMO') {
      return { filamentoId: null, insumoId: casarComCadastro(item.descricaoNota, insumos) };
    }
    return { filamentoId: null, insumoId: null };
  }
}

/**
 * A lista de campos ilegíveis é derivada do que veio nulo, unida ao que a IA declarou.
 *
 * Não dá pra confiar só na declaração: num teste com nota rasurada (29/07/2026) o modelo
 * devolveu fornecedor, data e valor todos null e mesmo assim mandou `camposIlegiveis: []`.
 * A tela usa essa lista pra pedir outra foto — vazia por engano, o buraco passa batido.
 * Campo nulo já é a evidência; a lista só precisa refletir isso.
 */
function alertasDaNota(nota: z.infer<typeof NotaLidaSchema>): string[] {
  const nulos = [
    nota.fornecedor == null ? 'fornecedor' : '',
    nota.data == null ? 'data' : '',
    nota.valorTotal == null ? 'valorTotal' : '',
  ].filter(Boolean);
  return [...new Set([...nota.camposIlegiveis, ...nulos])];
}

/**
 * Mesma ideia por linha, mas só marca o que impede a linha de virar movimento. Valor
 * unitário ausente com total presente não é buraco — `completarValores` resolve.
 */
function alertasDoItem(item: ItemLido, totalCentavos: number | null): string[] {
  const nulos = [
    item.quantidade == null ? 'quantidade' : '',
    item.unidade == null ? 'unidade' : '',
    item.tipo == null ? 'tipo' : '',
    totalCentavos == null ? 'valorTotal' : '',
    item.tipo === 'FILAMENTO' && item.gramasTotal == null ? 'gramasTotal' : '',
  ].filter(Boolean);
  return [...new Set([...item.camposIlegiveis, ...nulos])];
}

/** Reais → centavos. `Math.round` porque 115.5 * 100 dá 11549.999... em ponto flutuante. */
function emCentavos(reais: number | null | undefined): number | null {
  if (reais == null) return null;
  return Math.round(reais * 100);
}

/**
 * Preenche o valor que a nota não trouxe, quando dá pra derivar sem ambiguidade — é a
 * conta que pedimos ao modelo NÃO fazer, feita aqui onde o resultado é sempre o mesmo.
 * Falta quantidade, falta os dois valores: não inventa nada.
 */
function completarValores(item: ItemLido) {
  const unit = emCentavos(item.valorUnitario);
  const total = emCentavos(item.valorTotal);
  const qtd = item.quantidade;

  if (unit != null && total == null && qtd != null) {
    return { unitCentavos: unit, totalCentavos: Math.round(unit * qtd) };
  }
  if (total != null && unit == null && qtd != null && qtd > 0) {
    return { unitCentavos: Math.round(total / qtd), totalCentavos: total };
  }
  return { unitCentavos: unit, totalCentavos: total };
}
