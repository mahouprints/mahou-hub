---
name: Mahou Prints — biblioteca de cenários e mapeamento produto→cena
description: Cenários disponíveis em ~/ImageGen/templates/cenas/ e regra de seleção automática baseada na categoria do produto
type: reference
originSessionId: b2d851d8-d954-44cd-9389-2f6816f931ed
---
Biblioteca de cenários disponíveis em `C:\Users\PC\ImageGen\templates\cenas\`:

## Cenários ativos

| Pasta | Categoria | Quando usar |
|---|---|---|
| `wooden_warm_cozy/` | warm cozy | **DEFAULT** — produtos decorativos, organizadores de mesa, vasos, cortadores, marca-páginas, contadores de livros, brinquedos pet, cestas. Tem mesa de madeira light oak + Mahou Prints logo na parede + suculenta + livros |
| `bathroom_modern_black_marble/` | banheiro moderno | Produtos de banheiro: porta-escova, suporte de papel higiênico, gancho de toalha, dispenser, bandeja sabonete, porta-escova sanitária, organizador cosmético, cabide de toalha. Tem bancada granito preto + cuba branca + chuveiro box vidro + planta. **3 backgrounds**: closeup, medium, wide |
| `dark_moody_premium/` | noturno/escuro | ✅ PRONTO — Produtos que ACENDEM (abajures, luminárias, mobile com luz, LED). Cena de mesa Mahou Prints à NOITE com lamparina warm 2700K vinda do canto superior-direito iluminando parcialmente. Logo na parede em penumbra. Shadows warm-brown profundos. Produto aceso vira fonte secundária de luz |
| `nursery_soft_pastel/` | quarto bebê | Suporte mobile bebê, organizadores de quarto infantil. Sem cena fixa — gerado inline no prompt (berço VAZIO, teddy bear, mobile, soft pastels) |

## Regra de seleção (aplicar SEMPRE antes de gerar)

1. **Olhe o nome + refs do produto** e determine a categoria:
   - Banheiro (suporte papel, escova, sabonete, toalha) → `bathroom_modern_black_marble`
   - Acende/luminária → `dark_moody_premium`
   - Berço/bebê → `nursery_soft_pastel` (inline)
   - Decorativo, organizador, cortador, marca-página, etc → `wooden_warm_cozy` (default)

2. **Mapeamento direto** em `~/ImageGen/templates/template.json` na chave `mapeamento_produto_cena`.

3. **Se ambíguo, perguntar** ao usuário antes de gerar.

## Para banheiro (3 backgrounds disponíveis)

Selecionar o background pela escala do produto:
- Produto pequeno (bandeja sabonete, porta-escova de mesa) → `background_closeup.jpeg`
- Produto médio (organizador de bancada) → `background_medium.jpeg`
- Produto que precisa de contexto amplo (gancho de toalha na parede, suporte de papel instalado) → `background_wide.jpeg`

## Para abajures/produtos acesos

Aguardar `dark_moody_premium/background.jpeg` ser criado pelo usuário. Características da cena: ambiente escuro/noturno, baixa luz ambiente, espaço pro produto aceso ser fonte principal de luz. Inclui mesa de madeira da Mahou Prints mas em ambiente noite.

## Próximos passos (futuras cenas pendentes)

- `kitchen_warm/` — pra produtos de cozinha (porta-temperos, descanso de panela, etc) — ainda não criada
- `minimal_white_studio/` — ecommerce neutro — sem bg ainda
- `outdoor_natural/` — lifestyle outdoor — sem bg ainda
