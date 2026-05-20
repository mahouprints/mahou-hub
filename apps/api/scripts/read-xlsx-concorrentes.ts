// Lê a aba "Concorrentes" do Farm 3D xlsx e extrai {nome, shopeeUrl}.
// Outra coluna "Shopee" tem o texto rotulado "Shopee" e o link real no hyperlink.
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';

const XLSX = 'C:/Users/alexa/Downloads/Farm 3D $$$$$.xlsx';
const OUT = 'C:/Users/alexa/Documents/mahou-hub/apps/api/scripts/concorrentes-xlsx.json';

type Linha = {
  loja: string;
  instagram: string | null;
  shopeeUrl: string | null;
  mercadoLivre: string | null;
  website: string | null;
  observacao: string | null;
};

function hyperlink(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'hyperlink' in (value as object)) {
    const h = (value as { hyperlink?: string }).hyperlink;
    return h ?? null;
  }
  if (typeof value === 'string' && /^https?:\/\//.test(value)) return value;
  return null;
}

function texto(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'text' in (value as object)) {
    return String((value as { text: unknown }).text ?? '').trim() || null;
  }
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as any).richText.map((r: { text?: string }) => r.text ?? '').join('').trim() || null;
  }
  return String(value).trim() || null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet('Concorrentes');
  if (!ws) throw new Error('Aba "Concorrentes" não encontrada');

  const linhas: Linha[] = [];
  // r1 é header; pula
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const loja = texto(row.getCell(1).value);
    if (!loja) continue;
    linhas.push({
      loja,
      instagram: hyperlink(row.getCell(2).value),
      shopeeUrl: hyperlink(row.getCell(3).value),
      mercadoLivre: hyperlink(row.getCell(4).value),
      website: hyperlink(row.getCell(5).value),
      observacao: texto(row.getCell(6).value),
    });
  }

  const comShopee = linhas.filter((l) => l.shopeeUrl);
  console.log(`Total de linhas: ${linhas.length}`);
  console.log(`Com URL Shopee:  ${comShopee.length}`);
  console.log(`Sem URL Shopee:  ${linhas.length - comShopee.length}`);
  console.log();
  console.log('Lojas com URL Shopee:');
  for (const l of comShopee) {
    console.log(`  · ${l.loja.padEnd(32)} → ${l.shopeeUrl}`);
  }
  if (linhas.length - comShopee.length > 0) {
    console.log('\nSem URL Shopee:');
    for (const l of linhas) if (!l.shopeeUrl) console.log(`  · ${l.loja}`);
  }

  writeFileSync(OUT, JSON.stringify(linhas, null, 2), 'utf-8');
  console.log(`\nSalvo em ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
