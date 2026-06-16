-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'VISUALIZADOR');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "login" TEXT,
ADD COLUMN     "nome" TEXT,
ADD COLUMN     "papel" "Papel" NOT NULL DEFAULT 'ADMIN',
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");
