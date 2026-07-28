# Exemplo: busca direcionada

## Usuário pede

> "Busca miniaturas do Naruto na Shopee, quero ver se vale a pena entrar nesse nicho"

## Fluxo

1. **Chamar `buscar_oportunidades`**:
   ```json
   {
     "marketplace": "SHOPEE",
     "tipo": "keyword",
     "params": { "keyword": "miniatura naruto" },
     "filtros": { "vendasMin": 100, "precoMinCentavos": 2000, "precoMaxCentavos": 20000, "ratingMin": 4.0, "limit": 100 }
   }
   ```

2. **Analisar resposta**: aplique scoring nos top 20.

3. **Reportar resumido** (não despejar JSON cru):
   > Achei 47 produtos com >100 vendas/mês. Top 5 por oportunidade:
   >
   > 1. **Sasuke Susanoo 12cm** — R$ 49, ~1800 vendas/mês, rating 4.8 — score 78
   > 2. **Kakashi Sharingan funko-style 8cm** — R$ 35, ~2400 vendas/mês, rating 4.6 — score 75
   > 3. ...
   >
   > Risco: Naruto é IP da Pierrot/Shueisha. Volume baixo + sem distribuição oficial → área cinza, mas marcar nas notas.
   >
   > Quer que eu salve os top 10 com EM_ANALISE pra você decidir depois?

4. **Confirmação do usuário** → `salvar_oportunidades_em_lote`:
   ```json
   {
     "itens": [
       {
         "marketplace": "SHOPEE",
         "externalId": "12345678901",
         "productName": "Sasuke Susanoo 12cm",
         "priceMinCentavos": 4900,
         "priceMaxCentavos": 4900,
         "imageUrl": "https://...",
         "productLink": "https://shopee.com.br/...",
         "vendasEstimadasMes": 1800,
         "ratingStar": 4.8,
         "categoriaIds": [...],
         "lojaExternalId": "...",
         "lojaNome": "...",
         "fonte": "KEYWORD",
         "fonteParam": "miniatura naruto",
         "status": "EM_ANALISE",
         "score": 78,
         "notas": "**Demanda:** ~1800 v/mês (24 pts)\n**Preço:** R$ 49 (20 pts) sweet spot\n**Replicabilidade:** action figure de detalhe médio, multi-cor (14 pts)\n**Rating:** 4.8 (10 pts)\n**Risco:** IP Naruto — área cinza (-20 pts? não aplicar penalidade total se vai produzir mesmo assim, marcar na nota)\n**Sugestão:** versão escala 18cm — concorrência só faz até 12cm"
       },
       ...
     ]
   }
   ```

5. **Confirmar**:
   > Salvei 10 oportunidades em EM_ANALISE no backlog. Pode revisar em /oportunidades.
