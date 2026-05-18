-- AlterEnum
ALTER TYPE "Canal" ADD VALUE 'TIKTOK';

-- AlterTable
ALTER TABLE "Parametro" ADD COLUMN     "tiktokComissaoAfiliadoPct" DECIMAL(5,2) NOT NULL DEFAULT 30.00,
ADD COLUMN     "tiktokComissaoPlataformaPct" DECIMAL(5,2) NOT NULL DEFAULT 6.00,
ADD COLUMN     "tiktokTaxaPagamentoPct" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
ADD COLUMN     "tiktokTaxaSfpPct" DECIMAL(5,2) NOT NULL DEFAULT 6.00;
