import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MercadoLivreCotacaoInputSchema,
  type MercadoLivreCotacaoInput,
} from '@mahou-hub/contracts';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MercadoLivreService } from './mercado-livre.service';

const BuscaCategoriaSchema = z.string().trim().min(3).max(200);
const IdentificadorMlSchema = z
  .string()
  .regex(/^MLB\d+$/, 'Esperado identificador MLB seguido de números.');

@ApiTags('mercado-livre')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('mercado-livre')
export class MercadoLivreController {
  constructor(private readonly service: MercadoLivreService) {}

  @Get('categorias')
  @ApiOperation({ summary: 'Sugere categorias oficiais do ML pelo título do produto' })
  sugerirCategorias(@Query('q', new ZodValidationPipe(BuscaCategoriaSchema)) titulo: string) {
    return this.service.sugerirCategorias(titulo);
  }

  @Get('categorias/:id')
  @ApiOperation({ summary: 'Consulta caminho e permissão de anúncio da categoria ML' })
  categoria(@Param('id', new ZodValidationPipe(IdentificadorMlSchema)) id: string) {
    return this.service.categoria(id);
  }

  @Get('anuncios/:id')
  @ApiOperation({ summary: 'Lê contexto de anúncio pertencente à loja configurada' })
  anuncio(@Param('id', new ZodValidationPipe(IdentificadorMlSchema)) id: string) {
    return this.service.anuncio(id);
  }

  @Post('cotacao')
  @ApiOperation({ summary: 'Consulta tarifas e frete oficiais sem publicar anúncio' })
  cotar(
    @Body(new ZodValidationPipe(MercadoLivreCotacaoInputSchema)) contexto: MercadoLivreCotacaoInput,
  ) {
    return this.service.cotar(contexto);
  }
}
