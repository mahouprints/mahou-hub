-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "custoUnitarioCentavos" INTEGER NOT NULL,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoInsumo" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "qtd" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "ProdutoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_nome_key" ON "Insumo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoInsumo_produtoId_insumoId_key" ON "ProdutoInsumo"("produtoId", "insumoId");

-- AddForeignKey
ALTER TABLE "ProdutoInsumo" ADD CONSTRAINT "ProdutoInsumo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoInsumo" ADD CONSTRAINT "ProdutoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
