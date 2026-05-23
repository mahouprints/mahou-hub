---
name: Mahou Prints — layer lines FDM com profundidade real
description: Layer lines em produtos 3D printados são geometria física (micro-ressaltos), não textura plana aplicada — devem ter highlight no topo e shadow no recesso
type: feedback
originSessionId: 1d7a4ea6-083d-46dc-aed3-dc4485ff12aa
---
Layer lines FDM em produtos da Mahou Prints: **sutis mas com profundidade real**. Cada camada (0.2mm) é uma extrusão física da impressora — tem altura. Visualmente isso significa: highlight sutil no topo de cada camada (onde a luz pega) e shadow leve no recesso entre camadas. Não é uma textura aplicada/desenhada na superfície lisa — é geometria.

**Why:** Usuário (2026-05-16) explicou na rodada 3 do suporte-controle-ps5: "as camadas de impressão, lembre-se que elas são sutis, porém elas tem que ter profundidade para parecer reais, não como uma textura na peça". Rodadas anteriores: rodada 1 tinha círculos concêntricos errados, rodada 2 ficou sem layer lines (SLA-like liso), rodada 3 com linhas mas planas/decalque.

**How to apply:**
- Adicionar ao prompt de geração: "Layer lines are real 3D geometry — each 0.2mm horizontal ring is a physical micro-ridge. Light catches a thin highlight along the upper edge of each layer, with a subtle shadow recess between layers. NOT a painted/applied texture on a flat surface — actual stepped geometry. Subtle but with real depth."
- Reforçar lighting: "raking side light from low angle reveals the stepped texture without overpowering it"
- Padrão recorrente: Nano Banana Pro tende a "limpar" layer lines em produtos pretos matte (contraste preto-preto). Compensar com ênfase em luz/sombra entre camadas.
- Aplicar em TODOS os produtos novos da skill `/gerar-imagem`
