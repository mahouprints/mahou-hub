/**
 * Descobre se a nota que acabou de ser lida já entrou no sistema antes.
 *
 * Existem dois graus de certeza, e eles levam a tratamentos diferentes:
 *
 * - **FORTE** — é o mesmo documento, sem dúvida. Chave de acesso da NF-e igual (44 dígitos,
 *   únicos no país) ou número da nota + CNPJ do emitente iguais. Confirmar de novo é
 *   duplicar saldo, então a confirmação é recusada.
 * - **FRACA** — mesmo fornecedor, mesmo dia, mesmo valor. Cheira a duplicata, mas duas
 *   compras iguais no mesmo dia acontecem de verdade. Só avisa; quem decide é o Gabriel.
 */

export type NivelDuplicata = 'FORTE' | 'FRACA';

export interface NotaComparavel {
  chaveNfe: string | null;
  numeroNota: string | null;
  cnpjEmitente: string | null;
  fornecedor: string | null;
  valorCentavos: number | null;
  data: Date;
}

export interface ReciboComparavel extends NotaComparavel {
  id: string;
  /** CONFIRMADO significa que o estoque daquela nota já se moveu. */
  status: string;
}

export interface Duplicata {
  reciboId: string;
  nivel: NivelDuplicata;
  /** Se o recibo encontrado já lançou estoque. É o que separa bloquear de só avisar. */
  jaLancado: boolean;
}

/**
 * @example detectarNotaDuplicada(lida, outrosRecibos)
 *          // => { reciboId: 'r1', nivel: 'FORTE', jaLancado: true }
 */
export function detectarNotaDuplicada(
  candidata: NotaComparavel,
  existentes: ReciboComparavel[],
): Duplicata | null {
  const achados = existentes
    .map((r) => ({ recibo: r, nivel: compararNotas(candidata, r) }))
    .filter((a): a is { recibo: ReciboComparavel; nivel: NivelDuplicata } => a.nivel !== null);

  if (achados.length === 0) return null;

  // Nota já lançada importa mais que nota só cadastrada, e certeza forte mais que fraca —
  // é o pior caso que a tela precisa mostrar primeiro.
  const pior =
    achados.find((a) => a.nivel === 'FORTE' && a.recibo.status === 'CONFIRMADO') ??
    achados.find((a) => a.nivel === 'FORTE') ??
    achados.find((a) => a.recibo.status === 'CONFIRMADO') ??
    achados[0]!;

  return {
    reciboId: pior.recibo.id,
    nivel: pior.nivel,
    jaLancado: pior.recibo.status === 'CONFIRMADO',
  };
}

function compararNotas(a: NotaComparavel, b: NotaComparavel): NivelDuplicata | null {
  const chaveA = soDigitos(a.chaveNfe);
  const chaveB = soDigitos(b.chaveNfe);
  if (chaveA && chaveA === chaveB) return 'FORTE';

  const numA = semZerosAEsquerda(a.numeroNota);
  const numB = semZerosAEsquerda(b.numeroNota);
  const cnpjA = soDigitos(a.cnpjEmitente);
  const cnpjB = soDigitos(b.cnpjEmitente);
  if (numA && numA === numB && cnpjA && cnpjA === cnpjB) return 'FORTE';

  const forn = normalizar(a.fornecedor);
  if (
    forn &&
    forn === normalizar(b.fornecedor) &&
    a.valorCentavos != null &&
    a.valorCentavos === b.valorCentavos &&
    mesmoDia(a.data, b.data)
  ) {
    return 'FRACA';
  }

  return null;
}

function soDigitos(v: string | null): string {
  return (v ?? '').replace(/\D/g, '');
}

/** "000140499" e "140499" são a mesma nota — o zero à esquerda é formatação do emissor. */
function semZerosAEsquerda(v: string | null): string {
  return soDigitos(v).replace(/^0+/, '');
}

function normalizar(v: string | null): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
