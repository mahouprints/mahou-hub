import type { Filamento, Impressora } from './types';
import { arredondarCentavos } from './money';

/**
 * Custo do filamento usado no produto.
 * Réplica da fórmula da coluna H (Custo Filamento) da aba Produtos:
 *   (peso em g / 1000) * custo do filamento por kg
 *
 * @example custoFilamentoCentavos(50, 6300) // 50g de filamento a R$63/kg = 315 centavos
 */
export function custoFilamentoCentavos(pesoG: number, custoKgCentavos: number): number {
  if (pesoG < 0 || custoKgCentavos < 0) {
    throw new Error(`Entradas devem ser >= 0; recebi pesoG=${pesoG}, custoKg=${custoKgCentavos}`);
  }
  return arredondarCentavos((pesoG / 1000) * custoKgCentavos);
}

/**
 * Soma materiais antes de arredondar para evitar acumular centavos por cor.
 * Ex.: dois materiais de 0,3 centavo cada custam 1 centavo ao todo.
 */
export function custoFilamentosCentavos(
  filamentos: Array<{ pesoG: number; filamento: Pick<Filamento, 'custoKgCentavos'> }>,
): number {
  const custoTotal = filamentos.reduce((total, item) => {
    const custoKg = item.filamento.custoKgCentavos;
    if (item.pesoG < 0 || custoKg < 0) {
      throw new Error(`Entradas devem ser >= 0; recebi pesoG=${item.pesoG}, custoKg=${custoKg}`);
    }
    // Pesos da composição têm duas casas: calcular com inteiros evita 1,5 virar 1,499999…
    return total + Math.round(item.pesoG * 100) * custoKg;
  }, 0);
  return arredondarCentavos(custoTotal / 100000);
}

/**
 * Custo de energia da impressão.
 * Réplica da fórmula da coluna J (Custo Energético) da aba Produtos:
 *   tempo (h) * potência (W) / 1000 * tarifa (R$/kWh)
 *
 * @example custoEnergiaCentavos(2, 180, 60) // 2h × 180W × R$0,60/kWh = 21,6 ≈ 22 centavos
 */
export function custoEnergiaCentavos(
  tempoH: number,
  filamento: Filamento,
  impressora: Impressora,
  tarifaKwhCentavos: number,
): number {
  if (tempoH < 0 || tarifaKwhCentavos < 0) {
    throw new Error(
      `Entradas devem ser >= 0; recebi tempoH=${tempoH}, tarifa=${tarifaKwhCentavos}`,
    );
  }
  const potenciaW = impressora === 'A1' ? filamento.potenciaA1W : filamento.potenciaH2cW;
  return arredondarCentavos((tempoH * potenciaW * tarifaKwhCentavos) / 1000);
}
