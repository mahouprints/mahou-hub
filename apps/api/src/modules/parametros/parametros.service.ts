import { Injectable } from '@nestjs/common';
import type { ParametroUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sempre id=1 — singleton. Cria se não existe. */
  async get() {
    const existente = await this.prisma.parametro.findUnique({ where: { id: 1 } });
    if (existente) return existente;
    return this.prisma.parametro.create({
      data: {
        id: 1,
        tarifaKwhCentavos: 60,
        vendedorShopee: 'CNPJ',
        emCampanhaShopee: false,
        adicionalCampanhaPct: 2.5,
        comissaoMlPct: 15,
        impostoAtivo: false,
        impostoPct: 0,
      },
    });
  }

  update(data: ParametroUpdate) {
    const { id: _ignore, ...rest } = data;
    void _ignore;
    const defaults = {
      id: 1,
      tarifaKwhCentavos: 60,
      vendedorShopee: 'CNPJ' as const,
      emCampanhaShopee: false,
      adicionalCampanhaPct: 2.5,
      comissaoMlPct: 15,
      impostoAtivo: false,
      impostoPct: 0,
    };
    return this.prisma.parametro.upsert({
      where: { id: 1 },
      update: rest,
      create: { ...defaults, ...rest },
    });
  }

  listTaxasShopee() {
    return this.prisma.taxaShopee.findMany({ orderBy: { limInferiorCentavos: 'asc' } });
  }

  listTaxasMl() {
    return this.prisma.taxaMercadoLivre.findMany({ orderBy: { limInferiorCentavos: 'asc' } });
  }
}
