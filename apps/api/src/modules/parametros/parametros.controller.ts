import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  FaixaMercadoLivreCreateSchema,
  FaixaMercadoLivreUpdateSchema,
  FaixaShopeeCreateSchema,
  FaixaShopeeUpdateSchema,
  ParametroUpdateSchema,
  type FaixaMercadoLivreCreate,
  type FaixaMercadoLivreUpdate,
  type FaixaShopeeCreate,
  type FaixaShopeeUpdate,
  type ParametroUpdate,
} from '@mahou-hub/contracts';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ParametrosService } from './parametros.service';

@ApiTags('parametros')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('parametros')
export class ParametrosController {
  constructor(private readonly service: ParametrosService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  update(@Body(new ZodValidationPipe(ParametroUpdateSchema)) data: ParametroUpdate) {
    return this.service.update(data);
  }

  @Get('taxas/shopee')
  taxasShopee() {
    return this.service.listTaxasShopee();
  }

  @Post('taxas/shopee')
  createTaxaShopee(@Body(new ZodValidationPipe(FaixaShopeeCreateSchema)) data: FaixaShopeeCreate) {
    return this.service.createTaxaShopee(data);
  }

  @Patch('taxas/shopee/:id')
  updateTaxaShopee(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FaixaShopeeUpdateSchema)) data: FaixaShopeeUpdate,
  ) {
    return this.service.updateTaxaShopee(id, data);
  }

  @Delete('taxas/shopee/:id')
  deleteTaxaShopee(@Param('id') id: string) {
    return this.service.deleteTaxaShopee(id);
  }

  @Get('taxas/ml')
  taxasMl() {
    return this.service.listTaxasMl();
  }

  @Post('taxas/ml')
  createTaxaMl(@Body(new ZodValidationPipe(FaixaMercadoLivreCreateSchema)) data: FaixaMercadoLivreCreate) {
    return this.service.createTaxaMl(data);
  }

  @Patch('taxas/ml/:id')
  updateTaxaMl(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FaixaMercadoLivreUpdateSchema)) data: FaixaMercadoLivreUpdate,
  ) {
    return this.service.updateTaxaMl(id, data);
  }

  @Delete('taxas/ml/:id')
  deleteTaxaMl(@Param('id') id: string) {
    return this.service.deleteTaxaMl(id);
  }
}
