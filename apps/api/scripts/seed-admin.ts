/**
 * Cria (ou recria a senha de) o usuário admin único do Hub.
 * Lê email e senha das envs ADMIN_EMAIL e ADMIN_INITIAL_PASSWORD.
 *
 * Uso: tsx scripts/seed-admin.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !senha) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_INITIAL_PASSWORD em apps/api/.env');
  }
  const senhaHash = await argon2.hash(senha);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash },
    create: { email, senhaHash },
  });
  console.log(`admin pronto: ${usuario.email} (id=${usuario.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
