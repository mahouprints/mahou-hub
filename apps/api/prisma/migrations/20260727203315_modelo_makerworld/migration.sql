-- CreateEnum
CREATE TYPE "ModeloMakerWorldStatus" AS ENUM ('NOVO', 'FAVORITO', 'DESCARTADO', 'VIROU_PRODUTO');

-- CreateTable
CREATE TABLE "ModeloMakerWorld" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "curtidas" INTEGER NOT NULL DEFAULT 0,
    "colecoes" INTEGER NOT NULL DEFAULT 0,
    "licenca" TEXT NOT NULL,
    "licencaVeredicto" TEXT NOT NULL,
    "licencaObrigacao" TEXT NOT NULL,
    "nicho" TEXT NOT NULL,
    "pesoGramas" DECIMAL(10,2) NOT NULL,
    "tempoHoras" DECIMAL(10,2) NOT NULL,
    "custoEstimadoCentavos" INTEGER NOT NULL,
    "precoSugeridoCentavos" INTEGER NOT NULL,
    "margemEstimadaPct" DECIMAL(5,2) NOT NULL,
    "lucroPorHoraCentavos" INTEGER NOT NULL,
    "scoreObjetivo" INTEGER NOT NULL,
    "notaIa" INTEGER NOT NULL,
    "veredictoIa" TEXT NOT NULL,
    "justificativaIa" TEXT NOT NULL,
    "alertas" TEXT[],
    "tags" TEXT[],
    "temFotoReal" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModeloMakerWorldStatus" NOT NULL DEFAULT 'NOVO',
    "observacao" TEXT,
    "produtoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloMakerWorld_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeloMakerWorld_externalId_key" ON "ModeloMakerWorld"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloMakerWorld_produtoId_key" ON "ModeloMakerWorld"("produtoId");

-- CreateIndex
CREATE INDEX "ModeloMakerWorld_status_notaIa_idx" ON "ModeloMakerWorld"("status", "notaIa" DESC);

-- CreateIndex
CREATE INDEX "ModeloMakerWorld_nicho_notaIa_idx" ON "ModeloMakerWorld"("nicho", "notaIa" DESC);

-- CreateIndex
CREATE INDEX "ModeloMakerWorld_lucroPorHoraCentavos_idx" ON "ModeloMakerWorld"("lucroPorHoraCentavos" DESC);

-- AddForeignKey
ALTER TABLE "ModeloMakerWorld" ADD CONSTRAINT "ModeloMakerWorld_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
