/** Grava o dia escolhido sem carregar o horário/fuso do navegador. Ex.: domingo às 23h continua domingo no banco. */
export function dataUtcDoDiaLocal(instante: Date): Date {
  return new Date(Date.UTC(instante.getFullYear(), instante.getMonth(), instante.getDate()));
}

/** Abre uma data civil persistida no calendário local. Ex.: 2026-09-20T00:00Z continua dia 20 na Bahia. */
export function dataLocalDeDiaCivil(valor: Date | string): Date {
  const dia = (typeof valor === 'string' ? valor : valor.toISOString()).slice(0, 10);
  return new Date(`${dia}T12:00:00`);
}

/** Exibe o dia persistido sem recuar para a véspera. Ex.: 2026-09-20T00:00Z → 20/09/2026. */
export function formatarDataCivil(valor: Date | string): string {
  return (typeof valor === 'string' ? valor : valor.toISOString())
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/');
}
