/**
 * Capacidade de produção (unidades inteiras) dado um pool de horas disponíveis e o
 * tempo unitário de um produto. Réplica da coluna L (Capacidade) da aba Simulador,
 * que usa INT() para arredondar pra baixo.
 */
export function capacidade(horasDisponiveis: number, tempoUnitarioH: number): number {
  if (tempoUnitarioH <= 0) {
    throw new Error(`tempoUnitarioH deve ser > 0; recebi ${tempoUnitarioH}`);
  }
  return Math.floor(horasDisponiveis / tempoUnitarioH);
}

export interface CenarioEntrada {
  horasPorDia: number;
  dias: number;
  utilizacaoPct: number;
  numeroImpressoras: number;
  tempoUnitarioH: number;
  precoCentavos: number;
  liquidoUnitarioCentavos: number;
}

export interface CenarioSaida {
  horasTotais: number;
  capacidadeUnidades: number;
  faturamentoCentavos: number;
  lucroLiquidoCentavos: number;
  margem: number;
}

/**
 * Projeta um cenário de produção. Réplica das colunas K-O da aba Simulador.
 *
 * @example
 *   simularCenario({ horasPorDia: 24, dias: 31, utilizacaoPct: 80, numeroImpressoras: 1,
 *                    tempoUnitarioH: 0.75, precoCentavos: 1990, liquidoUnitarioCentavos: 610 })
 */
export function simularCenario(entrada: CenarioEntrada): CenarioSaida {
  const {
    horasPorDia,
    dias,
    utilizacaoPct,
    numeroImpressoras,
    tempoUnitarioH,
    precoCentavos,
    liquidoUnitarioCentavos,
  } = entrada;

  const horasTotais = horasPorDia * dias * (utilizacaoPct / 100) * numeroImpressoras;
  const capacidadeUnidades = capacidade(horasTotais, tempoUnitarioH);
  const faturamento = capacidadeUnidades * precoCentavos;
  const lucro = capacidadeUnidades * liquidoUnitarioCentavos;

  return {
    horasTotais,
    capacidadeUnidades,
    faturamentoCentavos: faturamento,
    lucroLiquidoCentavos: lucro,
    margem: faturamento === 0 ? 0 : lucro / faturamento,
  };
}
