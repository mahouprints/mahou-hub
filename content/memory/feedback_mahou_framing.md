---
name: Mahou Prints — framing do produto
description: Em todas as imagens geradas para Mahou Prints, o produto deve ser o foco visual claro — ocupar 60-70% do frame, próximo à câmera, não tomado pelo ambiente
type: feedback
originSessionId: 1d7a4ea6-083d-46dc-aed3-dc4485ff12aa
---
Nas imagens da skill `/gerar-imagem` para Mahou Prints: **o produto é o protagonista, não o ambiente**. Câmera próxima, produto ocupa 60-70% do frame, ambiente serve só como contexto (cena, props, logo).

**Why:** Usuário (2026-05-16) viu rodada 3 do suporte-controle-ps5 e disse "as imagens estão ficando muito distantes, lembre-se para esse projeto e para os próximos que o foco é o produto e ele precisa ficar mais próximo à câmera". Imagens anteriores tinham produto pequeno no centro com muito ambiente em volta — vira "foto de ambiente com produto", não "produto em ambiente".

**How to apply:**
- Adicionar ao prompt de geração: "Close-up product photography style — product fills 60-70% of the frame, camera positioned close to the product (~30-40cm equivalent). Background and props (logo, plant, books) visible but secondary, gently blurred (shallow DOF)."
- Aplicar em TODOS os produtos novos da skill `/gerar-imagem`, não só este
- Se gerar e produto ficar pequeno demais, regerar imediatamente sem perguntar
