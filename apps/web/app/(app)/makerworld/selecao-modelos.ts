export type SelecaoMakerworld = 'maquina-coloridos' | 'flexi-60g' | '';

/** Abre a seleção comum ao lote importado. Ex.: [{ tags: ['maquina-coloridos'] }]. */
export function selecaoDoLote(modelos: Array<{ tags: string[] }>): SelecaoMakerworld {
  if (modelos.length === 0) return '';
  if (modelos.every((modelo) => modelo.tags.includes('maquina-coloridos')))
    return 'maquina-coloridos';
  if (modelos.every((modelo) => modelo.tags.includes('flexi-60g'))) return 'flexi-60g';
  return '';
}
