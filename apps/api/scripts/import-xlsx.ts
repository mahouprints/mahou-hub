/**
 * Importa dados da planilha legada `Farm 3D $$$$$.xlsx` para o Postgres.
 *
 * Uso:
 *   tsx scripts/import-xlsx.ts "/caminho/Farm 3D $$$$$.xlsx"
 *
 * O script é idempotente em Filamentos (nome único) e Taxas (limInferior/faixa únicos).
 * Produtos são re-criados se nome+filamento bater — checar antes de rodar em produção.
 */
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

function reaisStrParaCentavos(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return Math.round(raw * 100);
  const s = String(raw).replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`Valor monetário inválido na planilha: "${raw}"`);
  }
  return Math.round(n * 100);
}

function numeroOuZero(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

async function importarFilamentos(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.getWorksheet('Filamentos');
  if (!ws) throw new Error('Aba Filamentos não encontrada');
  let count = 0;
  ws.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
    if (rowNumber <= 2) return;
    const nome = String(row.getCell(1).value ?? '').trim();
    if (!nome) return;
    const custoKg = reaisStrParaCentavos(row.getCell(2).value);
    const a1 = Math.round(numeroOuZero(row.getCell(3).value));
    const h2c = Math.round(numeroOuZero(row.getCell(4).value));
    const obs = row.getCell(5).value ? String(row.getCell(5).value) : null;
    await prisma.filamento.upsert({
      where: { nome },
      create: { nome, custoKgCentavos: custoKg, potenciaA1W: a1, potenciaH2cW: h2c, observacao: obs },
      update: { custoKgCentavos: custoKg, potenciaA1W: a1, potenciaH2cW: h2c, observacao: obs },
    });
    count++;
  });
  console.log(`filamentos importados: ${count}`);
}

async function importarParametros(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.getWorksheet('Parâmetros');
  if (!ws) throw new Error('Aba Parâmetros não encontrada');

  // Defined names da planilha: C20 vendedor Shopee, C21 COMM_ML, C22 CAMPANHA(sim/não),
  // C23 adicional, C24 tarifa, C26 IMPOSTO_ATIVO
  const vendedorRaw = String(ws.getCell('C20').value ?? 'CNPJ').toUpperCase();
  const vendedor =
    vendedorRaw.includes('CNPJ')
      ? 'CNPJ'
      : vendedorRaw.includes('ALTO') || vendedorRaw.includes('>450')
        ? 'CPF_ALTO'
        : 'CPF_BAIXO';
  const commMl = numeroOuZero(ws.getCell('C21').value) * 100; // vem como 0.15 → 15
  const campanha = String(ws.getCell('C22').value ?? 'Não').toLowerCase().includes('sim');
  const adicional = numeroOuZero(ws.getCell('C23').value) * 100;
  const tarifaKwhCentavos = reaisStrParaCentavos(ws.getCell('C24').value);
  const imposto = String(ws.getCell('C26').value ?? 'Não').toLowerCase().includes('sim');

  await prisma.parametro.upsert({
    where: { id: 1 },
    update: {
      tarifaKwhCentavos,
      vendedorShopee: vendedor,
      emCampanhaShopee: campanha,
      adicionalCampanhaPct: adicional,
      comissaoMlPct: commMl,
      impostoAtivo: imposto,
    },
    create: {
      id: 1,
      tarifaKwhCentavos,
      vendedorShopee: vendedor,
      emCampanhaShopee: campanha,
      adicionalCampanhaPct: adicional,
      comissaoMlPct: commMl,
      impostoAtivo: imposto,
      impostoPct: 0,
    },
  });

  // Tabela Shopee A4:F8
  for (let r = 4; r <= 8; r++) {
    const lim = reaisStrParaCentavos(ws.getCell(`A${r}`).value);
    const comissaoPct = numeroOuZero(ws.getCell(`B${r}`).value) * 100;
    const cnpj = reaisStrParaCentavos(ws.getCell(`C${r}`).value);
    const cpfBaixo = reaisStrParaCentavos(ws.getCell(`D${r}`).value);
    const cpfAlto = reaisStrParaCentavos(ws.getCell(`E${r}`).value);
    await prisma.taxaShopee.upsert({
      where: { limInferiorCentavos: lim },
      update: { comissaoPct, fixaCnpjCentavos: cnpj, fixaCpfBaixoCentavos: cpfBaixo, fixaCpfAltoCentavos: cpfAlto },
      create: {
        limInferiorCentavos: lim,
        comissaoPct,
        fixaCnpjCentavos: cnpj,
        fixaCpfBaixoCentavos: cpfBaixo,
        fixaCpfAltoCentavos: cpfAlto,
      },
    });
  }

  // Tabela ML A12:E16 (faixa A..E)
  const faixas = ['A', 'B', 'C', 'D', 'E'] as const;
  for (let i = 0; i < faixas.length; i++) {
    const r = 12 + i;
    const faixa = faixas[i]!;
    const lim = reaisStrParaCentavos(ws.getCell(`B${r}`).value);
    const fixo = reaisStrParaCentavos(ws.getCell(`C${r}`).value);
    const alternativo = numeroOuZero(ws.getCell(`D${r}`).value) * 100;
    const commCategoria = numeroOuZero(ws.getCell(`E${r}`).value) * 100;
    await prisma.taxaMercadoLivre.upsert({
      where: { faixa },
      update: { limInferiorCentavos: lim, custoFixoCentavos: fixo, pctAlternativo: alternativo, comissaoCategoriaPct: commCategoria },
      create: {
        faixa,
        limInferiorCentavos: lim,
        custoFixoCentavos: fixo,
        pctAlternativo: alternativo,
        comissaoCategoriaPct: commCategoria,
      },
    });
  }
  console.log('parâmetros + taxas importados');
}

async function importarProdutos(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.getWorksheet('Produtos');
  if (!ws) throw new Error('Aba Produtos não encontrada');
  const filamentos = await prisma.filamento.findMany();
  const porNome = new Map(filamentos.map((f) => [f.nome.toLowerCase(), f]));
  let count = 0;
  const rows = ws.getRows(2, ws.rowCount - 1) ?? [];
  for (const row of rows) {
    const nome = String(row.getCell(1).value ?? '').trim();
    if (!nome) continue;
    const nomeFilamento = String(row.getCell(4).value ?? '').trim().toLowerCase();
    const filamento = porNome.get(nomeFilamento);
    if (!filamento) {
      console.warn(`pulado: produto "${nome}" sem filamento "${nomeFilamento}"`);
      continue;
    }
    const pesoG = numeroOuZero(row.getCell(5).value);
    const tempoH = numeroOuZero(row.getCell(6).value);
    const impressoraRaw = String(row.getCell(7).value ?? 'A1').toUpperCase();
    const impressora = impressoraRaw.includes('H2C') ? 'H2C' : 'A1';
    const embalagem = reaisStrParaCentavos(row.getCell(9).value);
    const preco = reaisStrParaCentavos(row.getCell(11).value);
    const canalRaw = String(row.getCell(17).value ?? 'SITE').toUpperCase();
    const canal = canalRaw.includes('SHOPEE') ? 'SHOPEE' : canalRaw.includes('ML') ? 'ML' : 'SITE';
    if (pesoG <= 0 || tempoH <= 0 || preco <= 0) continue;

    await prisma.produto.create({
      data: {
        nome,
        inspiracao: row.getCell(2).value ? String(row.getCell(2).value) : null,
        modelo3dUrl: row.getCell(3).value ? String(row.getCell(3).value) : null,
        filamentoId: filamento.id,
        pesoG,
        tempoH,
        impressora,
        embalagemCentavos: embalagem,
        precoCentavos: preco,
        canalPrincipal: canal,
      },
    });
    count++;
  }
  console.log(`produtos importados: ${count}`);
}

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('uso: tsx scripts/import-xlsx.ts <caminho-do-xlsx>');
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(arquivo));
  await importarFilamentos(wb);
  await importarParametros(wb);
  await importarProdutos(wb);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
