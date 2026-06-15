-- CreateEnum
CREATE TYPE "TipoItemEstoque" AS ENUM ('PRODUTO', 'FILAMENTO', 'INSUMO');

-- CreateEnum
CREATE TYPE "MotivoMovimento" AS ENUM ('ESTOQUE_INICIAL', 'COMPRA', 'PRODUCAO', 'VENDA', 'AJUSTE', 'PERDA');

-- AlterTable
ALTER TABLE "Filamento" ADD COLUMN     "estoqueGramas" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "estoqueMinGramas" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "estoqueAtual" DECIMAL(10,3) NOT NULL DEFAULT 0,
ADD COLUMN     "estoqueMinimo" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProdutoVariacao" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "filamentoId" TEXT,
    "precoCentavos" INTEGER,
    "estoqueAtual" INTEGER NOT NULL DEFAULT 0,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoVariacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL,
    "tipoItem" "TipoItemEstoque" NOT NULL,
    "variacaoId" TEXT,
    "filamentoId" TEXT,
    "insumoId" TEXT,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "saldoApos" DECIMAL(12,3) NOT NULL,
    "motivo" "MotivoMovimento" NOT NULL,
    "custoUnitCentavos" INTEGER,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoVariacao_sku_key" ON "ProdutoVariacao"("sku");

-- CreateIndex
CREATE INDEX "ProdutoVariacao_produtoId_idx" ON "ProdutoVariacao"("produtoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_tipoItem_criadoEm_idx" ON "MovimentoEstoque"("tipoItem", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "MovimentoEstoque_variacaoId_idx" ON "MovimentoEstoque"("variacaoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_filamentoId_idx" ON "MovimentoEstoque"("filamentoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_insumoId_idx" ON "MovimentoEstoque"("insumoId");

-- AddForeignKey
ALTER TABLE "ProdutoVariacao" ADD CONSTRAINT "ProdutoVariacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoVariacao" ADD CONSTRAINT "ProdutoVariacao_filamentoId_fkey" FOREIGN KEY ("filamentoId") REFERENCES "Filamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "ProdutoVariacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_filamentoId_fkey" FOREIGN KEY ("filamentoId") REFERENCES "Filamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
