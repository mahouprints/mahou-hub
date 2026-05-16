/**
 * Importa dados da planilha legada `Farm 3D $$$$$.xlsx` para o Postgres.
 *
 * Uso:
 *   tsx scripts/import-xlsx.ts "/caminho/Farm 3D $$$$$.xlsx"
 *
 * Idempotente em Filamentos (nome único) e Taxas (limInferior/faixa únicos).
 * Produtos são criados apenas se ainda não houver um com o mesmo nome
 * (planilha pode ter ~249 linhas com algumas variações; rerun não duplica).
 */
import 'dotenv/config';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

/** Retorna centavos a partir de número ou string monetária. 0 quando não parseável. */
function reaisParaCentavos(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'object' && raw !== null && 'result' in raw) {
    return reaisParaCentavos((raw as { result: unknown }).result);
  }
  if (typeof raw === 'number') return Math.round(raw * 100);
  const s = String(raw).replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function numeroOuZero(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'object' && raw !== null && 'result' in raw) {
    return numeroOuZero((raw as { result: unknown }).result);
  }
  if (typeof raw === 'number') return raw;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function textoCelula(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && 'result' in raw) {
    return String((raw as { result: unknown }).result ?? '');
  }
  if (typeof raw === 'object' && 'text' in raw) {
    return String((raw as { text: unknown }).text ?? '');
  }
  return String(raw);
}

async function importarFilamentos(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.getWorksheet('Filamentos');
  if (!ws) throw new Error('Aba Filamentos não encontrada');
  let count = 0;
  // Cabeçalho está na linha 2, dados começam na linha 3.
  for (let rowNumber = 3; rowNumber <= ws.rowCount; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const nome = textoCelula(row.getCell(1).value).trim();
    if (!nome) continue;
    if (nome.startsWith('💡') || nome.toLowerCase().includes('para adicionar')) break;

    const custoKgCentavos = reaisParaCentavos(row.getCell(2).value);
    const potenciaA1W = Math.round(numeroOuZero(row.getCell(3).value));
    const potenciaH2cW = Math.round(numeroOuZero(row.getCell(4).value));
    if (custoKgCentavos === 0 || potenciaA1W === 0 || potenciaH2cW === 0) continue;

    const observacao = row.getCell(5).value ? textoCelula(row.getCell(5).value) : null;

    await prisma.filamento.upsert({
      where: { nome },
      create: { nome, custoKgCentavos, potenciaA1W, potenciaH2cW, observacao },
      update: { custoKgCentavos, potenciaA1W, potenciaH2cW, observacao },
    });
    count++;
  }
  console.log(`filamentos importados: ${count}`);
}

function mapearVendedor(raw: string): 'CNPJ' | 'CPF_BAIXO' | 'CPF_ALTO' {
  const v = raw.toUpperCase();
  if (v.includes('CNPJ')) return 'CNPJ';
  if (v.includes('ALTO') || v.includes('>450') || v.includes('450')) return 'CPF_ALTO';
  return 'CPF_BAIXO';
}

async function importarParametros(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.getWorksheet('Parâmetros');
  if (!ws) throw new Error('Aba Parâmetros não encontrada');

  const vendedor = mapearVendedor(textoCelula(ws.getCell('C20').value));
  const commMlRaw = numeroOuZero(ws.getCell('C21').value);
  const commMl = commMlRaw < 1 ? commMlRaw * 100 : commMlRaw;
  const campanha = textoCelula(ws.getCell('C22').value).toLowerCase().includes('sim');
  const adicionalRaw = numeroOuZero(ws.getCell('C23').value);
  const adicional = adicionalRaw < 1 ? adicionalRaw * 100 : adicionalRaw;
  const tarifaKwhCentavos = reaisParaCentavos(ws.getCell('C24').value);
  const imposto = textoCelula(ws.getCell('C26').value).toLowerCase().includes('sim');

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

  // Tabela Shopee linhas 4-8: A=Lim, B=Comissão%, C=Fixa CNPJ, D=Fixa CPF baixo, E=Fixa CPF alto
  for (let r = 4; r <= 8; r++) {
    const limInferiorCentavos = reaisParaCentavos(ws.getCell(`A${r}`).value);
    const comissaoRaw = numeroOuZero(ws.getCell(`B${r}`).value);
    const comissaoPct = comissaoRaw < 1 ? comissaoRaw * 100 : comissaoRaw;
    const cnpj = reaisParaCentavos(ws.getCell(`C${r}`).value);
    const cpfBaixo = reaisParaCentavos(ws.getCell(`D${r}`).value);
    const cpfAlto = reaisParaCentavos(ws.getCell(`E${r}`).value);
    await prisma.taxaShopee.upsert({
      where: { limInferiorCentavos },
      update: { comissaoPct, fixaCnpjCentavos: cnpj, fixaCpfBaixoCentavos: cpfBaixo, fixaCpfAltoCentavos: cpfAlto },
      create: {
        limInferiorCentavos,
        comissaoPct,
        fixaCnpjCentavos: cnpj,
        fixaCpfBaixoCentavos: cpfBaixo,
        fixaCpfAltoCentavos: cpfAlto,
      },
    });
  }

  // Tabela ML linhas 12-16: A=Faixa, B=Lim, C=Custo Fixo, D=% alt, E=Comissão categoria
  const faixas = ['A', 'B', 'C', 'D', 'E'] as const;
  for (let i = 0; i < faixas.length; i++) {
    const r = 12 + i;
    const faixa = faixas[i]!;
    const limInferiorCentavos = reaisParaCentavos(ws.getCell(`B${r}`).value);
    const custoFixoCentavos = reaisParaCentavos(ws.getCell(`C${r}`).value);
    const pctAltRaw = numeroOuZero(ws.getCell(`D${r}`).value);
    const pctAlternativo = pctAltRaw < 1 ? pctAltRaw * 100 : pctAltRaw;
    const commRaw = numeroOuZero(ws.getCell(`E${r}`).value);
    const comissaoCategoriaPct = commRaw < 1 ? commRaw * 100 : commRaw;
    await prisma.taxaMercadoLivre.upsert({
      where: { faixa },
      update: { limInferiorCentavos, custoFixoCentavos, pctAlternativo, comissaoCategoriaPct },
      create: {
        faixa,
        limInferiorCentavos,
        custoFixoCentavos,
        pctAlternativo,
        comissaoCategoriaPct,
      },
    });
  }
  console.log('parâmetros + taxas importados');
}

async function importarProdutos(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.getWorksheet('Produtos');
  if (!ws) throw new Error('Aba Produtos não encontrada');

  const filamentos = await prisma.filamento.findMany();
  const porNome = new Map(filamentos.map((f) => [f.nome.toLowerCase().trim(), f]));

  const existentes = new Set((await prisma.produto.findMany({ select: { nome: true } })).map((p) => p.nome));
  let criados = 0;
  let pulados = 0;

  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const nome = textoCelula(row.getCell(1).value).trim();
    if (!nome) continue;
    if (existentes.has(nome)) continue;

    const nomeFilamento = textoCelula(row.getCell(4).value).trim().toLowerCase();
    const filamento = porNome.get(nomeFilamento);
    if (!filamento) {
      pulados++;
      continue;
    }

    const pesoG = numeroOuZero(row.getCell(5).value);
    const tempoH = numeroOuZero(row.getCell(6).value);
    const preco = reaisParaCentavos(row.getCell(11).value);
    if (pesoG <= 0 || tempoH <= 0 || preco <= 0) {
      pulados++;
      continue;
    }

    const impressoraRaw = textoCelula(row.getCell(7).value).toUpperCase();
    const impressora = impressoraRaw.includes('H2C') ? 'H2C' : 'A1';
    const embalagem = reaisParaCentavos(row.getCell(9).value);
    const canalRaw = textoCelula(row.getCell(17).value).toUpperCase();
    const canal = canalRaw.includes('SHOPEE')
      ? 'SHOPEE'
      : canalRaw.includes('ML') || canalRaw.includes('MERCADO')
        ? 'ML'
        : 'SITE';

    await prisma.produto.create({
      data: {
        nome,
        inspiracao: row.getCell(2).value ? textoCelula(row.getCell(2).value) : null,
        modelo3dUrl: row.getCell(3).value ? textoCelula(row.getCell(3).value) : null,
        filamentoId: filamento.id,
        pesoG,
        tempoH,
        impressora,
        embalagemCentavos: embalagem,
        precoCentavos: preco,
        canalPrincipal: canal,
      },
    });
    criados++;
  }
  console.log(`produtos importados: ${criados} (pulados ${pulados})`);
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
