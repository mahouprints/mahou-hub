-- AlterTable
ALTER TABLE "Filamento" ADD COLUMN     "siglaCor" TEXT;

-- AlterTable
ALTER TABLE "ProdutoVariacao" ADD COLUMN     "pesoG" DECIMAL(10,2),
ADD COLUMN     "tempoH" DECIMAL(10,2);
