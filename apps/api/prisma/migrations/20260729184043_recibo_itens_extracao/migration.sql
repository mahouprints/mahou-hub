-- CreateEnum
CREATE TYPE "ReciboStatus" AS ENUM ('PENDENTE', 'EXTRAIDO', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "ReciboItemTipo" AS ENUM ('FILAMENTO', 'INSUMO', 'NAO_ESTOCAVEL');

-- AlterTable
ALTER TABLE "Recibo" ADD COLUMN     "camposIlegiveis" TEXT[],
ADD COLUMN     "confirmadoEm" TIMESTAMP(3),
ADD COLUMN     "extraidoEm" TIMESTAMP(3),
ADD COLUMN     "status" "ReciboStatus" NOT NULL DEFAULT 'PENDENTE';

-- CreateTable
CREATE TABLE "ReciboItem" (
    "id" TEXT NOT NULL,
    "reciboId" TEXT NOT NULL,
    "descricaoNota" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3),
    "unidade" TEXT,
    "valorUnitCentavos" INTEGER,
    "valorTotalCentavos" INTEGER,
    "tipo" "ReciboItemTipo",
    "categoriaCusto" "CategoriaCusto",
    "filamentoId" TEXT,
    "insumoId" TEXT,
    "gramasTotal" INTEGER,
    "camposIlegiveis" TEXT[],
    "movimentoRegistrado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReciboItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReciboItem_reciboId_idx" ON "ReciboItem"("reciboId");

-- CreateIndex
CREATE INDEX "ReciboItem_filamentoId_idx" ON "ReciboItem"("filamentoId");

-- CreateIndex
CREATE INDEX "ReciboItem_insumoId_idx" ON "ReciboItem"("insumoId");

-- CreateIndex
CREATE INDEX "Recibo_status_idx" ON "Recibo"("status");

-- AddForeignKey
ALTER TABLE "ReciboItem" ADD CONSTRAINT "ReciboItem_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboItem" ADD CONSTRAINT "ReciboItem_filamentoId_fkey" FOREIGN KEY ("filamentoId") REFERENCES "Filamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboItem" ADD CONSTRAINT "ReciboItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
