import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ParametroUpdateSchema, type ParametroUpdate } from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ParametrosService } from './parametros.service';

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

  @Get('taxas/ml')
  taxasMl() {
    return this.service.listTaxasMl();
  }
}
