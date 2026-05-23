---
name: Mahou Prints — layer lines somem com luz acesa
description: Quando produto translúcido está ACESO, layer lines micro NÃO devem ser enfatizadas no prompt — a luz interna apaga os ridges
type: feedback
originSessionId: b2d851d8-d954-44cd-9389-2f6816f931ed
---
Para produtos translúcidos (abajures, luminárias) gerados com a lâmpada ACESA: NÃO insistir em "real 3D geometric layer lines visible" no prompt. A luz interna apaga os micro-ressaltos de 0.2mm — eles ficam imperceptíveis pelo brilho atravessando o material. Tentar forçar layer-lines visíveis em produto aceso produz resultado artificial (Nano Banana exagera ridges como se fossem grooves profundos com sombra, quando na realidade ficam apagados).

**Why:** Usuário corrigiu em 2026-05-17 durante geração do abajur-bubble. A ref real do abajur estava aceso e mostra layers SUMINDO sob a translucidez iluminada; nossa primeira gen warm 2700K errou tentando manter highlight/shadow forçado nos layers.

**How to apply:**
- Para produto **DESLIGADO ou natural light**: manter bloco FDM SURFACE completo (highlight/shadow per layer + raking light).
- Para produto **ACESO (translúcido glowing)**: substituir o bloco FDM SURFACE por algo tipo: "Subtle horizontal layer lines visible only where the internal light gradient transitions — most of the shade reads as smooth translucent glow with layer lines barely perceptible as faint horizontal variations in light intensity rather than physical ridges. Do NOT show deep grooves or dark shadow recesses between layers — internal light washes them out."
- Sempre usar a ref real (aceso) como guia visual; se a ref mostra superfície quase lisa quando lit, replicar isso.
