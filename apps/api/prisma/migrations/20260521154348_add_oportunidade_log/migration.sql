-- CreateEnum
CREATE TYPE "OportunidadeLogAcao" AS ENUM ('CREATED', 'STATUS_CHANGE', 'SCORE_CHANGE', 'NOTAS_CHANGE', 'VIRARAM_PRODUTO');

-- CreateTable
CREATE TABLE "OportunidadeLog" (
    "id" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "acao" "OportunidadeLogAcao" NOT NULL,
    "detalhes" JSONB NOT NULL,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OportunidadeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OportunidadeLog_oportunidadeId_criadoEm_idx" ON "OportunidadeLog"("oportunidadeId", "criadoEm" DESC);

-- AddForeignKey
ALTER TABLE "OportunidadeLog" ADD CONSTRAINT "OportunidadeLog_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "ProdutoOportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
