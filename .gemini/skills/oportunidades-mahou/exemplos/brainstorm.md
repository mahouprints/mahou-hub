# Exemplo: brainstorm exploratório

## Usuário pede

> "Varre o que tá bombando na Shopee e me dá 10 ideias pra produzir"

## Fluxo

1. **Pegar contexto** com `estatisticas_oportunidades`:
   > Você tem 47 oportunidades NOVO + 12 EM_ANALISE + 3 DESCARTADAS já no backlog. Vou evitar duplicar.

2. **Chamar `explorar_top_vendas`** com filtros baseline conservadores:
   ```json
   {
     "marketplace": "SHOPEE",
     "filtros": {
       "vendasMin": 500,
       "precoMinCentavos": 2500,
       "precoMaxCentavos": 12000,
       "ratingMin": 4.3,
       "limit": 200
     }
   }
   ```

3. **Curar (você é multimodal — usa nome + imagem)**:
   - Descartar eletrônicos, têxtil, alimentos, cosméticos (ver [criterios-3d.md](../criterios-3d.md))
   - Marcar risco em produtos com IP/marca
   - Calcular [score](../scoring.md) nos imprimíveis

4. **Reportar antes de salvar**:
   > Varri 200 produtos top vendidos. Imprimíveis em 3D que **não estão no backlog**: 23.
   >
   > Top 10 por score:
   >
   > 1. **Porta-controle PS5/Xbox parede** — R$ 39, ~4500 v/mês, score 87
   > 2. **Organizador de gaveta modular** — R$ 28, ~3200 v/mês, score 82
   > 3. **Suporte celular cama** — R$ 35, ~2800 v/mês, score 79
   > 4. **Miniatura urso geek** — R$ 45, ~2100 v/mês, score 76
   > 5. ...
   >
   > Tendências que percebi:
   > - Organizadores (4 dos 10) — categoria forte agora
   > - Suportes pra gamer (3 dos 10) — Black Friday se aproxima
   > - Decoração minimalista (3 dos 10) — vasos lineares, plaquinhas
   >
   > Salvar os 10 em EM_ANALISE com score e notas detalhadas?

5. **Após confirmação** → `salvar_oportunidades_em_lote` com `fonte='TOP_VENDAS'`, `fonteParam=null`, score e notas estruturadas conforme [scoring.md](../scoring.md).

6. **Fechar**:
   > Pronto. 10 candidatos novos em EM_ANALISE. Recomendo revisar /oportunidades hoje — o top 1 (porta-controle) tem demanda altíssima e pouca concorrência variada.
