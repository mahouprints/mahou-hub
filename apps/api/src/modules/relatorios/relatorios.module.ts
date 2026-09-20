import { Module } from '@nestjs/common';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosConfiguracaoService } from './relatorios-configuracao.service';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [FinanceiroModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatoriosConfiguracaoService],
})
export class RelatoriosModule {}
