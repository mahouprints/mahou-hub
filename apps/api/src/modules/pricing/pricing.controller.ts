import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CalcularInputSchema,
  SimularInputSchema,
  type CalcularInput,
  type SimularInput,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PricingService } from './pricing.service';

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
}
