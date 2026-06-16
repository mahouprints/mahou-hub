-- AlterTable
ALTER TABLE "JobProducao" ADD COLUMN     "consumoProdutoRegistrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "daEstoque" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variacaoId" TEXT;

-- CreateIndex
CREATE INDEX "JobProducao_variacaoId_idx" ON "JobProducao"("variacaoId");

-- AddForeignKey
ALTER TABLE "JobProducao" ADD CONSTRAINT "JobProducao_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "ProdutoVariacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
