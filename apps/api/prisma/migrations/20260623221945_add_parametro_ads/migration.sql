-- AlterTable
ALTER TABLE "Parametro" ADD COLUMN     "adsBudgetDiarioMinimoCentavos" INTEGER,
ADD COLUMN     "adsCadenciaIncrementoDias" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "adsCpcMedioCentavos" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "adsFatorMargemEscala" DECIMAL(4,2) NOT NULL DEFAULT 1.40,
ADD COLUMN     "adsJanelaTesteDias" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "adsNDegraus" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "adsNivelConfianca" INTEGER NOT NULL DEFAULT 95,
ADD COLUMN     "adsPassoIncrementoPct" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
ADD COLUMN     "adsTaxaRetornoPct" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
ADD COLUMN     "adsTetoBudgetDiarioCentavos" INTEGER;
