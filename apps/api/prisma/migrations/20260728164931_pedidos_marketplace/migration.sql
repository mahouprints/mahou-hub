-- CreateEnum
CREATE TYPE "PedidoStatus" AS ENUM ('PENDENTE', 'ATENDIDO', 'BLOQUEADO', 'CANCELADO', 'ENVIADO');

-- CreateEnum
CREATE TYPE "PedidoItemAtendimento" AS ENUM ('SEM_VINCULO', 'BAIXADO_ESTOQUE', 'EM_PRODUCAO');

-- CreateTable
CREATE TABLE "PedidoMarketplace" (
    "id" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "externalId" TEXT NOT NULL,
    "statusExterno" TEXT NOT NULL,
    "compradorNome" TEXT,
    "totalCentavos" INTEGER NOT NULL,
    "prazoEnvio" TIMESTAMP(3),
    "dataPedido" TIMESTAMP(3) NOT NULL,
    "status" "PedidoStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoMarketplace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "skuExterno" TEXT NOT NULL,
    "nomeExterno" TEXT NOT NULL,
    "qtd" INTEGER NOT NULL,
    "precoUnitarioCentavos" INTEGER NOT NULL,
    "variacaoId" TEXT,
    "atendimento" "PedidoItemAtendimento" NOT NULL DEFAULT 'SEM_VINCULO',
    "jobProducaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoMarketplace_status_prazoEnvio_idx" ON "PedidoMarketplace"("status", "prazoEnvio");

-- CreateIndex
CREATE INDEX "PedidoMarketplace_dataPedido_idx" ON "PedidoMarketplace"("dataPedido" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoMarketplace_canal_externalId_key" ON "PedidoMarketplace"("canal", "externalId");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItem_atendimento_idx" ON "PedidoItem"("atendimento");

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoMarketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "ProdutoVariacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_jobProducaoId_fkey" FOREIGN KEY ("jobProducaoId") REFERENCES "JobProducao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
