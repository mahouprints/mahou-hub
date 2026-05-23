---
name: Mahou Prints — padrão de mãos em imagens
description: Quando aparecerem mãos em cenários de uso, sempre mão feminina de mulher branca, sem unhas detalhadas, sem acessórios
type: feedback
originSessionId: b2d851d8-d954-44cd-9389-2f6816f931ed
---
Quando o cenário gerado incluir mãos (típico em fotos "em uso" — pressionando cortador, segurando suporte, instalando produto, etc), as mãos devem seguir padrão consistente:

- **Gênero/pele:** mão feminina de mulher branca (caucasiana).
- **Unhas:** lisas, naturais, **sem esmalte, sem nail art, sem unhas longas**. Aparência neutra/curtas.
- **Acessórios:** **NENHUM**. Sem anéis, sem pulseiras, sem relógio, sem braceletes, sem tatuagens visíveis.
- **Aparência geral:** mãos limpas, naturais, sem make-up nas unhas, pele uniforme. Foco no produto, não na mão.

**Why:** Definido pelo usuário em 2026-05-17. Mantém consistência visual entre todos os anúncios da Mahou Prints — branding coerente. Acessórios e detalhes de unhas distraem do produto e podem desencaixar com identidade visual.

**How to apply:**
- No PRODUCT/SCENE block do prompt, sempre incluir: `"If hands are visible, they are FEMININE hands of a Caucasian/white woman. Plain natural fingernails — NO nail polish, NO nail art, NO long nails, just clean short natural nails. NO accessories: no rings, no bracelets, no watches, no jewelry of any kind, no visible tattoos. Hands appear clean and natural."`
- No AVOID block: `"NO nail polish. NO nail art. NO long acrylic nails. NO rings, bracelets, watches, or any hand accessories. NO tattoos on hands/wrists. NO male hands. NO non-white hands."`
- Aplica especialmente a: cortadores em uso, suporte mobile bebê (instalação), brinquedo gato (segurando), abajures (ligando), etc.
