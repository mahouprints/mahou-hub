-- CreateEnum
CREATE TYPE "SyncOrigem" AS ENUM ('MANUAL', 'CRON');

-- AlterTable
-- `atualizadoEm` ganha DEFAULT pra cobrir registros pré-existentes (Concorrente cadastrado manualmente antes desta migration).
ALTER TABLE "Concorrente" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "commissionRatePadrao" DECIMAL(5,4),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "ratingStar" DECIMAL(3,2),
ADD COLUMN     "sellerCommCoveRatio" DECIMAL(5,4),
ADD COLUMN     "shopId" BIGINT,
ADD COLUMN     "ultimoSyncEm" TIMESTAMP(3),
ADD COLUMN     "urlOriginal" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "ConcorrenteSnapshot" (
    "id" TEXT NOT NULL,
    "concorrenteId" TEXT NOT NULL,
    "sincronizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" "SyncOrigem" NOT NULL,
    "qtdProdutos" INTEGER NOT NULL DEFAULT 0,
    "erroMensagem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcorrenteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcorrenteSnapshotProduto" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "itemId" BIGINT NOT NULL,
    "productName" TEXT NOT NULL,
    "priceMinCentavos" INTEGER NOT NULL,
    "priceMaxCentavos" INTEGER NOT NULL,
    "priceDiscountRate" INTEGER NOT NULL,
    "sales" INTEGER NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionCentavos" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "productLink" TEXT NOT NULL,
    "offerLink" TEXT NOT NULL,
    "productCatIds" INTEGER[],
    "shopType" INTEGER[],
    "ratingStar" DECIMAL(3,2),
    "periodStartTime" TIMESTAMP(3) NOT NULL,
    "periodEndTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcorrenteSnapshotProduto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConcorrenteSnapshot_concorrenteId_sincronizadoEm_idx" ON "ConcorrenteSnapshot"("concorrenteId", "sincronizadoEm" DESC);

-- CreateIndex
CREATE INDEX "ConcorrenteSnapshotProduto_snapshotId_itemId_idx" ON "ConcorrenteSnapshotProduto"("snapshotId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Concorrente_shopId_key" ON "Concorrente"("shopId");

-- AddForeignKey
ALTER TABLE "ConcorrenteSnapshot" ADD CONSTRAINT "ConcorrenteSnapshot_concorrenteId_fkey" FOREIGN KEY ("concorrenteId") REFERENCES "Concorrente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcorrenteSnapshotProduto" ADD CONSTRAINT "ConcorrenteSnapshotProduto_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ConcorrenteSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
