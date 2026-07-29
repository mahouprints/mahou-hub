-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "reciboId" TEXT;

-- AlterTable
ALTER TABLE "Recibo" ADD COLUMN     "chaveNfe" TEXT,
ADD COLUMN     "cnpjEmitente" TEXT,
ADD COLUMN     "duplicataDeReciboId" TEXT,
ADD COLUMN     "numeroNota" TEXT;

-- CreateIndex
CREATE INDEX "MovimentoEstoque_reciboId_idx" ON "MovimentoEstoque"("reciboId");

-- CreateIndex
CREATE INDEX "Recibo_chaveNfe_idx" ON "Recibo"("chaveNfe");

-- CreateIndex
CREATE INDEX "Recibo_numeroNota_cnpjEmitente_idx" ON "Recibo"("numeroNota", "cnpjEmitente");

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
