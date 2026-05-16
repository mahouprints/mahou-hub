-- CreateEnum
CREATE TYPE "Impressora" AS ENUM ('A1', 'H2C');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('SHOPEE', 'ML', 'SITE');

-- CreateEnum
CREATE TYPE "VendedorShopeeTipo" AS ENUM ('CNPJ', 'CPF_BAIXO', 'CPF_ALTO');

-- CreateEnum
CREATE TYPE "Origem" AS ENUM ('ML', 'SHOPEE', 'SITE', 'ESTOQUE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('FILA', 'IMPRIMINDO', 'CONCLUIDO', 'EMBALADO', 'ENVIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "IdeiaStatus" AS ENUM ('BACKLOG', 'EM_ESTUDO', 'EM_PROD', 'ARQUIVADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "custoKgCentavos" INTEGER NOT NULL,
    "potenciaA1W" INTEGER NOT NULL,
    "potenciaH2cW" INTEGER NOT NULL,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "inspiracao" TEXT,
    "modelo3dUrl" TEXT,
    "filamentoId" TEXT NOT NULL,
    "pesoG" DECIMAL(10,2) NOT NULL,
    "tempoH" DECIMAL(10,2) NOT NULL,
    "impressora" "Impressora" NOT NULL,
    "embalagemCentavos" INTEGER NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "canalPrincipal" "Canal" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tarifaKwhCentavos" INTEGER NOT NULL,
    "vendedorShopee" "VendedorShopeeTipo" NOT NULL,
    "emCampanhaShopee" BOOLEAN NOT NULL DEFAULT false,
    "adicionalCampanhaPct" DECIMAL(5,2) NOT NULL,
    "comissaoMlPct" DECIMAL(5,2) NOT NULL,
    "impostoAtivo" BOOLEAN NOT NULL DEFAULT false,
    "impostoPct" DECIMAL(5,2) NOT NULL,
    "margemThresholdVerde" DECIMAL(4,3) NOT NULL DEFAULT 0.30,
    "margemThresholdAmarelo" DECIMAL(4,3) NOT NULL DEFAULT 0.15,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxaShopee" (
    "id" TEXT NOT NULL,
    "limInferiorCentavos" INTEGER NOT NULL,
    "comissaoPct" DECIMAL(5,2) NOT NULL,
    "fixaCnpjCentavos" INTEGER NOT NULL,
    "fixaCpfBaixoCentavos" INTEGER NOT NULL,
    "fixaCpfAltoCentavos" INTEGER NOT NULL,

    CONSTRAINT "TaxaShopee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxaMercadoLivre" (
    "id" TEXT NOT NULL,
    "faixa" TEXT NOT NULL,
    "limInferiorCentavos" INTEGER NOT NULL,
    "custoFixoCentavos" INTEGER NOT NULL,
    "pctAlternativo" DECIMAL(5,2) NOT NULL,
    "comissaoCategoriaPct" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "TaxaMercadoLivre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concorrente" (
    "id" TEXT NOT NULL,
    "loja" TEXT NOT NULL,
    "instagram" TEXT,
    "website" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Concorrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoConcorrente" (
    "id" TEXT NOT NULL,
    "concorrenteId" TEXT NOT NULL,
    "produtoSimilar" TEXT NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "capturadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fonteUrl" TEXT,

    CONSTRAINT "PrecoConcorrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conteudo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descricao" TEXT,
    "tags" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conteudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ideia" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "IdeiaStatus" NOT NULL DEFAULT 'BACKLOG',
    "referencia" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ideia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobProducao" (
    "id" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "origem" "Origem" NOT NULL,
    "produtoId" TEXT NOT NULL,
    "qtd" INTEGER NOT NULL,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "impressora" "Impressora" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'FILA',
    "anuncioCriado" BOOLEAN NOT NULL DEFAULT false,
    "anunciado" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobProducao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Filamento_nome_key" ON "Filamento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "TaxaShopee_limInferiorCentavos_key" ON "TaxaShopee"("limInferiorCentavos");

-- CreateIndex
CREATE UNIQUE INDEX "TaxaMercadoLivre_faixa_key" ON "TaxaMercadoLivre"("faixa");

-- CreateIndex
CREATE INDEX "JobProducao_status_idx" ON "JobProducao"("status");

-- CreateIndex
CREATE INDEX "JobProducao_dataInicio_idx" ON "JobProducao"("dataInicio");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_filamentoId_fkey" FOREIGN KEY ("filamentoId") REFERENCES "Filamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoConcorrente" ADD CONSTRAINT "PrecoConcorrente_concorrenteId_fkey" FOREIGN KEY ("concorrenteId") REFERENCES "Concorrente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobProducao" ADD CONSTRAINT "JobProducao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
