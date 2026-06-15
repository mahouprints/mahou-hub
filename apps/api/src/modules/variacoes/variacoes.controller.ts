import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ProdutoVariacaoCreateSchema,
  ProdutoVariacaoUpdateSchema,
  type ProdutoVariacaoCreate,
  type ProdutoVariacaoUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { VariacoesService } from './variacoes.service';

@ApiTags('variacoes')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('variacoes')
export class VariacoesController {
  constructor(private readonly service: VariacoesService) {}

  @Get()
  list(
    @Query('produtoId') produtoId: string,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    return this.service.listByProduto(produtoId, incluirInativos === 'true');
  }

  @Post()
  create(@Body(new ZodValidationPipe(ProdutoVariacaoCreateSchema)) data: ProdutoVariacaoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProdutoVariacaoUpdateSchema)) data: ProdutoVariacaoUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }
}
