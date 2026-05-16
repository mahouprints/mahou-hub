/**
 * Seed reproduzível do banco — replica os dados originais da planilha Farm 3D.
 *
 * Rode com: `pnpm --filter api exec prisma db seed`
 * É idempotente: usa upserts em todas as tabelas, então pode rodar várias vezes
 * sem duplicar registros nem perder dados que já foram editados manualmente.
 *
 * Origem dos dados: planilha `Farm 3D $$$$$.xlsx`, processada via
 * `scripts/import-xlsx.ts` em 2026-05-16 e congelada aqui para reprodução.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { FILAMENTOS } from './seed/filamentos';
import { PARAMETROS, TAXAS_SHOPEE, TAXAS_ML } from './seed/parametros';
import { CONCORRENTES } from './seed/concorrentes';
import { PRODUTOS } from './seed/produtos';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !senha) {
    console.log('admin: ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD não definidos, pulando');
    return;
  }
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) {
    console.log(`admin: ${email} já existe, pulando`);
    return;
  }
  const senhaHash = await argon2.hash(senha);
  await prisma.usuario.create({ data: { email, senhaHash } });
  console.log(`admin criado: ${email}`);
}

async function seedFilamentos() {
  for (const f of FILAMENTOS) {
    await prisma.filamento.upsert({
      where: { nome: f.nome },
      update: f,
      create: f,
    });
  }
  console.log(`filamentos: ${FILAMENTOS.length}`);
}

async function seedParametros() {
  await prisma.parametro.upsert({
    where: { id: 1 },
    update: PARAMETROS,
    create: { id: 1, ...PARAMETROS },
  });

  for (const t of TAXAS_SHOPEE) {
    await prisma.taxaShopee.upsert({
      where: { limInferiorCentavos: t.limInferiorCentavos },
      update: t,
      create: t,
    });
  }

  for (const t of TAXAS_ML) {
    await prisma.taxaMercadoLivre.upsert({
      where: { faixa: t.faixa },
      update: t,
      create: t,
    });
  }
  console.log(`parâmetros + taxas: ${TAXAS_SHOPEE.length} shopee, ${TAXAS_ML.length} ml`);
}

async function seedConcorrentes() {
  const existentes = new Set(
    (await prisma.concorrente.findMany({ select: { loja: true } })).map((c) => c.loja),
  );
  let criados = 0;
  for (const c of CONCORRENTES) {
    if (existentes.has(c.loja)) continue;
    await prisma.concorrente.create({ data: c });
    criados++;
  }
  console.log(`concorrentes: ${criados} novos (${existentes.size} já existiam)`);
}

async function seedProdutos() {
  const filamentos = await prisma.filamento.findMany();
  const porNome = new Map(filamentos.map((f) => [f.nome, f]));
  const existentes = new Set(
    (await prisma.produto.findMany({ select: { nome: true } })).map((p) => p.nome),
  );

  let criados = 0;
  let pulados = 0;
  for (const p of PRODUTOS) {
    if (existentes.has(p.nome)) continue;
    const filamento = porNome.get(p.filamentoNome);
    if (!filamento) {
      console.warn(`produto "${p.nome}" pulado: filamento "${p.filamentoNome}" não encontrado`);
      pulados++;
      continue;
    }
    const { filamentoNome: _omitir, ...rest } = p;
    void _omitir;
    await prisma.produto.create({
      data: {
        ...rest,
        filamentoId: filamento.id,
      },
    });
    criados++;
  }
  console.log(`produtos: ${criados} novos (${existentes.size} já existiam, ${pulados} pulados)`);
}

async function main() {
  console.log('--- seed mahou-hub ---');
  await seedAdmin();
  await seedFilamentos();
  await seedParametros();
  await seedConcorrentes();
  await seedProdutos();
  console.log('--- seed concluído ---');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
