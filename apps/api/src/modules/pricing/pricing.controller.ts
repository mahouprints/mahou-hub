import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CalcularInputSchema,
  PlanoAdsInputSchema,
  SimularInputSchema,
  type CalcularInput,
  type PlanoAdsInput,
  type SimularInput,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Post('calcular')
  calcular(@Body(new ZodValidationPipe(CalcularInputSchema)) input: CalcularInput) {
    return this.service.calcular(input);
  }

  @Post('simular')
  simular(@Body(new ZodValidationPipe(SimularInputSchema)) input: SimularInput) {
    return this.service.simular(input);
  }

  @Post('plano-ads')
  planoAds(@Body(new ZodValidationPipe(PlanoAdsInputSchema)) input: PlanoAdsInput) {
    return this.service.planoAds(input);
  }
}
