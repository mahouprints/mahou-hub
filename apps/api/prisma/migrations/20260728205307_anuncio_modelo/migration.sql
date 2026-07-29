-- CreateTable
CREATE TABLE "AnuncioModelo" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "marketplace" "Canal" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tags" TEXT[],
    "precoBaseCentavos" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnuncioModelo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnuncioModelo_modeloId_marketplace_key" ON "AnuncioModelo"("modeloId", "marketplace");

-- AddForeignKey
ALTER TABLE "AnuncioModelo" ADD CONSTRAINT "AnuncioModelo_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloMakerWorld"("id") ON DELETE CASCADE ON UPDATE CASCADE;
