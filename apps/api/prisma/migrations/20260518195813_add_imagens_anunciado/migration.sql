-- CreateEnum
CREATE TYPE "OrigemImagem" AS ENUM ('INSPIRACAO', 'MODELO_3D', 'GERADA', 'OUTRA');

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "anunciado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProdutoImagem" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "origem" "OrigemImagem" NOT NULL DEFAULT 'OUTRA',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "larguraPx" INTEGER,
    "alturaPx" INTEGER,
    "bytes" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoImagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProdutoImagem_produtoId_idx" ON "ProdutoImagem"("produtoId");

-- AddForeignKey
ALTER TABLE "ProdutoImagem" ADD CONSTRAINT "ProdutoImagem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
