-- CreateTable
CREATE TABLE "ConfiguracaoRelatorios" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "emailGoogle" TEXT NOT NULL,
    "destinatarios" TEXT[],
    "webhookUrl" TEXT,
    "segredoCifrado" TEXT NOT NULL,
    "ultimoAgendamentoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoRelatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioRelatorio" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "relatorio" JSONB NOT NULL,
    "destinatarios" TEXT[],
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processamentoEm" TIMESTAMP(3),
    "planilhaUrl" TEXT,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),

    CONSTRAINT "EnvioRelatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvioRelatorio_chave_key" ON "EnvioRelatorio"("chave");

-- CreateIndex
CREATE INDEX "EnvioRelatorio_status_proximaTentativaEm_idx" ON "EnvioRelatorio"("status", "proximaTentativaEm");

