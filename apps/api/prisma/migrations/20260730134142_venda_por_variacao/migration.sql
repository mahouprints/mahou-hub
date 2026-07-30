-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "pedidoItemId" TEXT,
ADD COLUMN     "variacaoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Venda_pedidoItemId_key" ON "Venda"("pedidoItemId");

-- CreateIndex
CREATE INDEX "Venda_variacaoId_idx" ON "Venda"("variacaoId");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "ProdutoVariacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

