-- Remoção do módulo Gap analysis (decisão 2026-05-23). Substituído pelo fluxo
-- mais simples de "produtos dos concorrentes" via endpoint denso
-- GET /concorrentes/produtos + tool MCP listar_produtos_concorrentes.

DROP TABLE IF EXISTS "ProdutoGapDecisao";
DROP TYPE  IF EXISTS "GapDecisao";
