-- CreateEnum
CREATE TYPE "OportunidadeMarketplace" AS ENUM ('SHOPEE', 'TIKTOK', 'ML', 'OUTRO');

-- CreateEnum
CREATE TYPE "OportunidadeFonte" AS ENUM ('CONCORRENTE', 'KEYWORD', 'CATEGORIA', 'TOP_VENDAS');

-- CreateEnum
CREATE TYPE "OportunidadeStatus" AS ENUM ('NOVO', 'EM_ANALISE', 'APROVADO', 'DESCARTADO', 'VIRARAM_PRODUTO');

-- AlterTable
ALTER TABLE "Concorrente" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ProdutoOportunidade" (
    "id" TEXT NOT NULL,
    "marketplace" "OportunidadeMarketplace" NOT NULL,
    "externalId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "priceMinCentavos" INTEGER NOT NULL,
    "priceMaxCentavos" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "productLink" TEXT NOT NULL,
    "vendasEstimadasMes" INTEGER NOT NULL,
    "ratingStar" DECIMAL(3,2),
    "categoriaIds" INTEGER[],
    "lojaExternalId" TEXT,
    "lojaNome" TEXT,
    "fonte" "OportunidadeFonte" NOT NULL,
    "fonteParam" TEXT,
    "concorrenteId" TEXT,
    "snapshotProdutoId" TEXT,
    "status" "OportunidadeStatus" NOT NULL DEFAULT 'NOVO',
    "score" DECIMAL(5,2),
    "notas" TEXT,
    "produtoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoOportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoOportunidade_produtoId_key" ON "ProdutoOportunidade"("produtoId");

-- CreateIndex
CREATE INDEX "ProdutoOportunidade_status_score_idx" ON "ProdutoOportunidade"("status", "score" DESC);

-- CreateIndex
CREATE INDEX "ProdutoOportunidade_criadoEm_idx" ON "ProdutoOportunidade"("criadoEm" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoOportunidade_marketplace_externalId_key" ON "ProdutoOportunidade"("marketplace", "externalId");

-- AddForeignKey
ALTER TABLE "ProdutoOportunidade" ADD CONSTRAINT "ProdutoOportunidade_concorrenteId_fkey" FOREIGN KEY ("concorrenteId") REFERENCES "Concorrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoOportunidade" ADD CONSTRAINT "ProdutoOportunidade_snapshotProdutoId_fkey" FOREIGN KEY ("snapshotProdutoId") REFERENCES "ConcorrenteSnapshotProduto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoOportunidade" ADD CONSTRAINT "ProdutoOportunidade_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
