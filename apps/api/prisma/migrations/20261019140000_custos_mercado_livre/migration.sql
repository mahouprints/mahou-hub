ALTER TABLE "Produto" ADD COLUMN "mercadoLivre" JSONB, ADD COLUMN "cotacaoMl" JSONB;
ALTER TABLE "PedidoItem"
  ADD COLUMN "mlItemId" TEXT,
  ADD COLUMN "tarifaMlCentavos" INTEGER,
  ADD COLUMN "freteMlCentavos" INTEGER,
  ADD COLUMN "custosMlAtualizadosEm" TIMESTAMP(3);

CREATE TABLE "MercadoLivreToken" (
  "sellerId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MercadoLivreToken_pkey" PRIMARY KEY ("sellerId")
);
