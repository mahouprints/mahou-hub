-- CreateEnum
CREATE TYPE "GapDecisao" AS ENUM ('MATCH_MANUAL', 'DESCARTADO');

-- CreateTable
CREATE TABLE "ProdutoGapDecisao" (
    "id" TEXT NOT NULL,
    "marketplace" "OportunidadeMarketplace" NOT NULL,
    "externalId" TEXT NOT NULL,
    "decisao" "GapDecisao" NOT NULL,
    "produtoId" TEXT,
    "observacao" TEXT,
    "decididoPor" TEXT,
    "decididoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoGapDecisao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProdutoGapDecisao_decisao_idx" ON "ProdutoGapDecisao"("decisao");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoGapDecisao_marketplace_externalId_key" ON "ProdutoGapDecisao"("marketplace", "externalId");

-- AddForeignKey
ALTER TABLE "ProdutoGapDecisao" ADD CONSTRAINT "ProdutoGapDecisao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
