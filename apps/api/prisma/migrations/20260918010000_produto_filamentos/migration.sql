CREATE TABLE "ProdutoFilamento" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "filamentoId" TEXT NOT NULL,
    "pesoG" DECIMAL(10,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProdutoFilamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProdutoFilamento_pesoG_check" CHECK ("pesoG" > 0)
);

ALTER TABLE "JobProducao" ADD COLUMN "consumoFilamentos" JSONB;

CREATE UNIQUE INDEX "ProdutoFilamento_produtoId_filamentoId_key" ON "ProdutoFilamento"("produtoId", "filamentoId");
CREATE INDEX "ProdutoFilamento_filamentoId_idx" ON "ProdutoFilamento"("filamentoId");
ALTER TABLE "ProdutoFilamento" ADD CONSTRAINT "ProdutoFilamento_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProdutoFilamento" ADD CONSTRAINT "ProdutoFilamento_filamentoId_fkey" FOREIGN KEY ("filamentoId") REFERENCES "Filamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
