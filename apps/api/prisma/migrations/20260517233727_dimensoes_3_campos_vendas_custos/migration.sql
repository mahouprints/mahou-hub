/*
  Warnings:

  - You are about to drop the column `dimensoes` on the `Produto` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CategoriaCusto" AS ENUM ('ALUGUEL', 'ENERGIA', 'INTERNET', 'SOFTWARE', 'MARKETING', 'INSUMOS', 'IMPOSTOS', 'OUTROS');

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "dimensoes",
ADD COLUMN     "alturaCm" DECIMAL(6,1),
ADD COLUMN     "larguraCm" DECIMAL(6,1),
ADD COLUMN     "profundidadeCm" DECIMAL(6,1);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "qtd" INTEGER NOT NULL,
    "precoUnitarioCentavos" INTEGER NOT NULL,
    "canal" "Canal" NOT NULL,
    "dataVenda" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Custo" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "CategoriaCusto" NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "dataCompetencia" TIMESTAMP(3) NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "geradoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Custo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venda_dataVenda_idx" ON "Venda"("dataVenda");

-- CreateIndex
CREATE INDEX "Venda_canal_idx" ON "Venda"("canal");

-- CreateIndex
CREATE INDEX "Custo_dataCompetencia_idx" ON "Custo"("dataCompetencia");

-- CreateIndex
CREATE INDEX "Custo_categoria_idx" ON "Custo"("categoria");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
