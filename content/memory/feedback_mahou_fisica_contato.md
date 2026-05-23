---
name: Mahou Prints — produtos sempre em contato com superfície
description: Todos os objetos numa imagem gerada devem estar APOIADOS em alguma superfície — nunca flutuando/voando no ar
type: feedback
originSessionId: b2d851d8-d954-44cd-9389-2f6816f931ed
---
Regra física universal: **NENHUM objeto pode flutuar/voar** em imagens geradas. Todo produto, prop, item — qualquer coisa visível — DEVE estar em contato físico com:
- A mesa (apoiado em cima)
- O chão / wooden cutting board
- Uma outra superfície (livro empilhado, prateleira, etc.)
- Sendo segurado por mão (esta é a única exceção válida)

**Why:** Usuário corrigiu em 2026-05-17 — vários produtos foram gerados "flutuando":
- Cortador Copa: cortadores em pé verticalmente como estatuetas, não deitados na mesa
- Cesta decorativa: objetos dentro/ao redor flutuando ao invés de pousados
- Outros podem ter o mesmo problema

**How to apply (sempre nos prompts):**
- Para cortadores planos/marca-páginas/etc: forçar **TOP-DOWN** com produto LYING FLAT na superfície.
- Para outros produtos: incluir bloco explícito tipo `"All objects in the scene are physically resting on a surface (table, cutting board, or held by hand). NO floating objects, NO objects suspended in mid-air."`
- No AVOID: `"NO floating objects. NO objects suspended in the air. NO levitating items. NO impossible physics — every visible object must touch a surface with a visible shadow underneath confirming contact."`
- Revisão Q4 obrigatória: ao revisar geração, verificar VISUALMENTE se cada objeto tem sombra/contato com superfície. Se não tiver, regerar ou usar Modo E pra corrigir.

**Quando NÃO usar top-down:**
- Produtos altos/3D escultorais (abajures, suportes, etc): mantém 3/4 angle normal, MAS sempre verificando que o produto está visualmente apoiado na mesa com sombra clara abaixo.
- Apenas cortadores planos / marca-páginas / bookmarks / objetos baixos achatados precisam de top-down obrigatório.
