-- Refator semântico: separar "venda do afiliado" (dado real bruto) de "vendas reais totais"
-- (enriquecimento manual futuro). Decisão 2026-05-23: parar de inflar com 1/0.05 — usuário
-- prefere o número honesto do afiliado normalizado pra base mensal.
--
-- O cron de sync (cmpa-cron domingo 03h) vai repopular os valores corretos no próximo run.
-- Como esses dados são reproduzíveis (refletem snapshot do mercado), não preservamos histórico
-- inflado — só convertemos pra valor honesto onde possível.

-- 1. Adicionar campo nullable pra enriquecimento manual de vendas reais totais
ALTER TABLE "ConcorrenteSnapshotProduto" ADD COLUMN "vendasReais" INTEGER;
ALTER TABLE "ProdutoOportunidade"        ADD COLUMN "vendasReais" INTEGER;

-- 2. Renomear o campo da heurística antiga (Shopee=5%) pro nome semântico correto
ALTER TABLE "ProdutoOportunidade" RENAME COLUMN "vendasEstimadasMes" TO "vendasAfiliadoMes";

-- 3. Desfazer a inflação dos valores antigos (× 0.05 = sales normalizado original)
-- Valores antigos eram (sales/dias × 30) / 0.05. Multiplicar por 0.05 devolve (sales/dias × 30),
-- que é o sales do afiliado normalizado pra mês. Próximo sync sobrescreve com valor fresco.
UPDATE "ProdutoOportunidade"
   SET "vendasAfiliadoMes" = GREATEST(0, ROUND("vendasAfiliadoMes" * 0.05));
