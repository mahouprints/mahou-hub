import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ShopeeProvider } from '../src/modules/oportunidades/providers/shopee.provider';
import type { AffiliateProductNode } from '../src/modules/concorrentes/shopee/queries';
import type { ShopeeAffiliateService } from '../src/modules/concorrentes/shopee-affiliate.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function makeProvider() {
  // ShopeeAffiliateService e PrismaService não são chamados nos métodos testados
  // (makeNodeFilter / applyFiltersToMaterialized), só passados ao construtor.
  return new ShopeeProvider({} as unknown as ShopeeAffiliateService, {} as unknown as PrismaService);
}

function node(over: Partial<AffiliateProductNode> = {}): AffiliateProductNode {
  // Janela de 30 dias (1700000000..1702592000 = ~Nov 2023). Defaults representativos.
  return {
    itemId: 1,
    productName: 'X',
    commissionRate: 0.1,
    commission: 1,
    sales: 50, // → 50/30*30 / 0.05 = 1000 vendas/mês
    priceMin: 50, // R$ 50 = 5000 centavos
    priceMax: 50,
    priceDiscountRate: 0,
    imageUrl: '',
    productLink: '',
    offerLink: '',
    periodStartTime: 1_700_000_000,
    periodEndTime: 1_700_000_000 + 30 * 86_400, // 30 dias depois
    shopId: 1,
    shopName: '',
    shopType: [],
    productCatIds: [],
    ratingStar: 4.5,
    ...over,
  };
}

describe('ShopeeProvider.makeNodeFilter', () => {
  const provider = makeProvider();

  it('aceita node base quando sem filtros', () => {
    const f = provider.makeNodeFilter({});
    expect(f(node())).toBe(true);
  });

  it('rejeita preço abaixo do mínimo', () => {
    const f = provider.makeNodeFilter({ precoMinCentavos: 6000 });
    expect(f(node({ priceMin: 30 }))).toBe(false); // R$30 < R$60 mín
    expect(f(node({ priceMin: 70 }))).toBe(true);
  });

  it('rejeita preço acima do máximo', () => {
    const f = provider.makeNodeFilter({ precoMaxCentavos: 5000 });
    expect(f(node({ priceMin: 80 }))).toBe(false); // R$80 > R$50 máx
    expect(f(node({ priceMin: 40 }))).toBe(true);
  });

  it('rejeita rating abaixo do mínimo (ratingStar null vira 0)', () => {
    const f = provider.makeNodeFilter({ ratingMin: 4 });
    expect(f(node({ ratingStar: 3.5 }))).toBe(false);
    expect(f(node({ ratingStar: null }))).toBe(false);
    expect(f(node({ ratingStar: 4.2 }))).toBe(true);
  });

  it('rejeita vendasMin pela normalização do sales afiliado', () => {
    const f = provider.makeNodeFilter({ vendasMin: 75 });
    // Default: sales=50, janela 30d → 50 vendas/mês (sem heurística inflada) — abaixo de 75.
    expect(f(node())).toBe(false);
    // sales=100 → 100 vendas/mês — passa.
    expect(f(node({ sales: 100 }))).toBe(true);
  });

  it('combina múltiplos filtros (AND)', () => {
    const f = provider.makeNodeFilter({ precoMinCentavos: 3000, vendasMin: 75, ratingMin: 4 });
    // 75 vendas/mês precisa de sales=75 (janela 30d → 75/30*30 = 75).
    expect(f(node({ priceMin: 50, sales: 80, ratingStar: 4.5 }))).toBe(true);
    expect(f(node({ priceMin: 20, sales: 80, ratingStar: 4.5 }))).toBe(false); // preço baixo
    expect(f(node({ priceMin: 50, sales: 20, ratingStar: 4.5 }))).toBe(false); // vendas baixas
  });
});
