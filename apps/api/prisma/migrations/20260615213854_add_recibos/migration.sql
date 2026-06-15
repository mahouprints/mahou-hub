-- CreateTable
CREATE TABLE "Recibo" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "fornecedor" TEXT,
    "valorCentavos" INTEGER,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReciboArquivo" (
    "id" TEXT NOT NULL,
    "reciboId" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReciboArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recibo_data_idx" ON "Recibo"("data" DESC);

-- CreateIndex
CREATE INDEX "ReciboArquivo_reciboId_idx" ON "ReciboArquivo"("reciboId");

-- AddForeignKey
ALTER TABLE "ReciboArquivo" ADD CONSTRAINT "ReciboArquivo_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
