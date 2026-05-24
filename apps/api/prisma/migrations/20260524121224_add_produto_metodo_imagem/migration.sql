-- CreateEnum
CREATE TYPE "MetodoImagem" AS ENUM ('IA', 'FOTO');

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "metodoImagem" "MetodoImagem";
