import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Canal } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import {
  BulkDeleteSchema,
  ProdutoCreateSchema,
  ProdutoUpdateSchema,
  type BulkDelete,
  type ProdutoCreate,
  type ProdutoUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProdutosService } from './produtos.service';

const BulkAnunciarSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  anunciado: z.boolean(),
});
type BulkAnunciar = z.infer<typeof BulkAnunciarSchema>;

// Whitelist explícita pra evitar SQL injection via orderBy.
const SORTABLE_FIELDS = ['criadoEm', 'atualizadoEm', 'nome', 'precoCentavos'] as const;

const ListQuerySchema = z.object({
  anunciado: z.enum(['true', 'false']).optional(),
  canal: z.nativeEnum(Canal).optional(),
  // temImagens=true filtra produtos com >=1 ProdutoImagem (qualquer origem).
  temImagens: z.enum(['true', 'false']).optional(),
  // temImagemGerada=true filtra por presença de ProdutoImagem com origem=GERADA
  // (foto final pra anúncio). Combine `temImagens=true & temImagemGerada=false` pra
  // fila da skill /gerar-imagem: tem refs upadas (INSPIRACAO/MODELO_3D) mas falta gerar.
  temImagemGerada: z.enum(['true', 'false']).optional(),
  // temReferencia=true filtra produtos com `inspiracao` OU `modelo3dUrl` preenchido
  // (URL textual, NÃO arquivo). Pra a fila da skill prefira `temImagens=true` —
  // textual sem upload de imagem não dá pra usar como ref no Flow.
  temReferencia: z.enum(['true', 'false']).optional(),
  // metodoImagem filtra a fila de trabalho: IA = gerar via skill, FOTO = fotografar
  // unidade impressa. NULL = produtos sem método decidido ainda.
  metodoImagem: z.enum(['IA', 'FOTO', 'NULL']).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  sortBy: z.enum(SORTABLE_FIELDS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

@ApiTags('produtos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista produtos ativos com filtros, busca e paginação',
    description:
      'Sem `page`/`pageSize` devolve todos os resultados (legado). Com paginação, ' +
      'devolve a página solicitada. Em ambos os casos, o total absoluto vai no header ' +
      '`X-Total-Count`. Headers expostos: `X-Total-Count`, `X-Page`, `X-Page-Size`.',
  })
  @ApiQuery({ name: 'anunciado', required: false, enum: ['true', 'false'], description: 'Filtra por flag anunciado' })
  @ApiQuery({ name: 'canal', required: false, enum: Canal, description: 'Filtra por canal principal' })
  @ApiQuery({ name: 'temImagens', required: false, enum: ['true', 'false'], description: 'Filtra por presença de pelo menos 1 ProdutoImagem (qualquer origem)' })
  @ApiQuery({ name: 'temImagemGerada', required: false, enum: ['true', 'false'], description: 'Filtra por presença de ProdutoImagem com origem=GERADA (foto final). Combine com temImagens=true pra fila da skill' })
  @ApiQuery({ name: 'temReferencia', required: false, enum: ['true', 'false'], description: 'Filtra por presença de inspiração ou modelo3dUrl (URL textual, NÃO arquivo)' })
  @ApiQuery({ name: 'metodoImagem', required: false, enum: ['IA', 'FOTO', 'NULL'], description: 'Filtra a fila: IA (skill), FOTO (fotografar) ou NULL (sem decisão)' })
  @ApiQuery({ name: 'q', required: false, description: 'Busca textual (case-insensitive) em nome + inspiração' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 200 } })
  @ApiQuery({ name: 'sortBy', required: false, enum: SORTABLE_FIELDS })
  @ApiQuery({ name: 'sortDir', required: false, enum: ['asc', 'desc'] })
  async list(@Query() query: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = ListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
    }
    const { anunciado, canal, temImagens, temImagemGerada, temReferencia, metodoImagem, q, page, pageSize, sortBy, sortDir } = parsed.data;
    // Se passou page sem pageSize (ou vice-versa), preenche o outro com default
    // sensato — evita armadilha "page=2 sozinho" que devolveria a página inteira.
    const pageNorm = page ?? (pageSize ? 1 : undefined);
    const pageSizeNorm = pageSize ?? (page ? 50 : undefined);

    const { items, total } = await this.service.list({
      anunciado: anunciado === 'true' ? true : anunciado === 'false' ? false : undefined,
      canal,
      temImagens: temImagens === 'true' ? true : temImagens === 'false' ? false : undefined,
      temImagemGerada: temImagemGerada === 'true' ? true : temImagemGerada === 'false' ? false : undefined,
      temReferencia: temReferencia === 'true' ? true : temReferencia === 'false' ? false : undefined,
      metodoImagem,
      q,
      page: pageNorm,
      pageSize: pageSizeNorm,
      sortBy,
      sortDir,
    });

    res.setHeader('X-Total-Count', String(total));
    if (pageNorm && pageSizeNorm) {
      res.setHeader('X-Page', String(pageNorm));
      res.setHeader('X-Page-Size', String(pageSizeNorm));
    }
    return items;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um produto' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/estatisticas')
  @ApiOperation({ summary: 'Estatísticas agregadas de vendas do produto' })
  estatisticas(@Param('id') id: string) {
    return this.service.estatisticas(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria produto' })
  create(@Body(new ZodValidationPipe(ProdutoCreateSchema)) data: ProdutoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza campos do produto (parcial)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProdutoUpdateSchema)) data: ProdutoUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete: marca produto como ativo=false (preserva histórico)' })
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Soft-delete em massa (até 500 ids)' })
  bulkDelete(@Body(new ZodValidationPipe(BulkDeleteSchema)) data: BulkDelete) {
    return this.service.desativarMuitos(data.ids);
  }

  @Post('bulk-anunciar')
  @ApiOperation({
    summary: 'Marca/desmarca a flag `anunciado` em N produtos',
    description: 'Usado pelo fluxo externo de publicação: consumer chama com ids e `anunciado: true` após publicar.',
  })
  bulkAnunciar(@Body(new ZodValidationPipe(BulkAnunciarSchema)) data: BulkAnunciar) {
    return this.service.marcarAnunciados(data.ids, data.anunciado);
  }
}
