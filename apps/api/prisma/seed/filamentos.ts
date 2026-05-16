export const FILAMENTOS = [
  {
    nome: 'ABS Branco',
    custoKgCentavos: 6300,
    potenciaA1W: 180,
    potenciaH2cW: 280,
    observacao: 'Câmara aquecida na H2C consome mais',
  },
  {
    nome: 'ASA Branco',
    custoKgCentavos: 13500,
    potenciaA1W: 160,
    potenciaH2cW: 160,
    observacao: null,
  },
  {
    nome: 'PETG Branco',
    custoKgCentavos: 7000,
    potenciaA1W: 130,
    potenciaH2cW: 160,
    observacao: 'Bed 75°C',
  },
  {
    nome: 'PLA Branco',
    custoKgCentavos: 11500,
    potenciaA1W: 90,
    potenciaH2cW: 120,
    observacao: 'Bed 55°C, sem chamber',
  },
] as const;
