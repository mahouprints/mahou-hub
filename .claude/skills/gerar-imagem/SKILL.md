# Skill: Gerador de Imagens de Produto 3D (Mahou Prints) via Google Flow

Gera imagens profissionais de produtos impressos em 3D da marca **Mahou Prints** usando Google Flow + Nano Banana Pro, com automação via Playwright MCP. Suporta **batch** (vários produtos em sequência) e **curadoria assíncrona** (gerar agora, revisar depois).

## Estrutura de pastas

```
C:\Users\PC\Documents\Mahou Prints\
├── products (pendente)\                # 🟡 input — refs novas aguardando geração
│   └── {Nome Produto}\
│       └── Referências\
│           └── {imagens de ref do produto}
├── products (em revisão)\              # 🟠 output do Modo D — aguardando revisão usuário
│   └── {produto-slug}\
│       ├── cenario1_hero_var{1-4}.jpeg
│       ├── cenario2_{uso}_var{1-4}.jpeg
│       ├── cenario3_{detalhe}_var{1-4}.jpeg
│       ├── referencias\                # refs originais
│       └── _meta.json                  # Flow project_id, media_ids, cenários
├── products\                           # ✅ aprovado final (após revisão)
│   └── {produto-slug}\                 # mesmo conteúdo, movido manualmente após OK do user
├── curadoria\                          # ⚠️ output do Modo A — aguardando curadoria
│   └── {produto-slug}\
│       ├── variacao_1.jpeg
│       ├── ...
│       ├── _meta.json
│       └── _curadoria.md               # checklist pro usuário marcar ✅/❌
```

**Fluxo Modo D autônomo (recomendado):**
`products (pendente)/` → [geração 3 cenários × 4 variações] → `products (em revisão)/` → [usuário revisa, dá feedback OU aprova] → `products/`

```
content/imagegen/                              # templates e histórico global
├── templates/
│   ├── template.json                    # config de cenas, filamentos, FDM, mapeamento produto→cena
│   └── cenas/
│       ├── wooden_warm_cozy/            # default — produtos decorativos genéricos
│       │   ├── background.jpeg
│       │   └── info.md
│       ├── bathroom_modern_black_marble/  # banheiro moderno — porta-escova, gancho de toalha, etc
│       │   ├── background_closeup.jpeg
│       │   ├── background_medium.jpeg
│       │   ├── background_wide.jpeg
│       │   └── info.md
│       ├── dark_moody_premium/          # ✅ noturno — abajures, produtos acesos
│       │   ├── background.jpeg          # mesa Mahou Prints à noite, lamparina warm 2700K canto-direito
│       │   └── info.md
│       └── nursery_soft_pastel/         # quarto bebê — gerado inline no prompt
└── feedback/historico.json             # log global de aprendizados
```

## Seleção automática de cenário (OBRIGATÓRIA antes de gerar)

Antes de criar projeto Flow para um produto, **identifique a categoria** dele e selecione o cenário correto. A regra está em `content/imagegen/templates/template.json` na chave `mapeamento_produto_cena` e `como_selecionar_cena`. Resumo:

| Categoria do produto | Cenário | Notas |
|---|---|---|
| Banheiro (porta-escova, suporte papel higiênico, gancho toalha, dispenser, bandeja sabonete, porta-escova sanitária, organizador cosmético, cabide) | `bathroom_modern_black_marble` | **3 backgrounds**: `background_closeup.jpeg` (produto pequeno), `background_medium.jpeg` (médio), `background_wide.jpeg` (instalado/contexto amplo) |
| Acende/luminária (abajur, mobile com luz, LED, vela, difusor luminoso) | `dark_moody_premium` | Cena Mahou Prints à NOITE com lamparina warm 2700K vinda canto-direito. Produto aceso vira fonte secundária. Layer lines suavizam por causa da translucidez quando iluminado (memória `feedback_mahou_layers_luz_acesa`) |
| Berço/quarto de bebê | `nursery_soft_pastel` | Sem bg fixo — descrever no prompt: berço VAZIO, teddy, mobile, sem bebês |
| **Default** (decorativo, organizador mesa, cortador, marca-página, contador, cesta, vaso, brinquedo pet, polaroid) | `wooden_warm_cozy` | Mesa madeira + Mahou Prints logo + suculenta + livros |

**Se ambíguo, perguntar ao usuário** antes de gerar.

## Modos de operação

A skill tem **7 modos**. O usuário pode invocar qualquer um, ou a skill detecta pela situação:

### Modo A — `gerar` (1 ou vários produtos novos, sem feedback imediato)
Fluxo otimizado pra processar 1 ou N produtos em batch. Sem pedir avaliação no fim — salva tudo em `curadoria/` pro usuário revisar depois.

### Modo B — `curar` (revisão das pendentes)
Lê pastas em `curadoria/`, mostra ao usuário, ele marca aprovações em `_curadoria.md`, depois Claude move aprovadas pra `products/` e regenera rejeitadas (reabrindo projeto Flow pelo `_meta.json`).

### Modo C — `iterar` (refinar produto específico)
Reabre projeto Flow existente, gera nova rodada com prompt ajustado, salva em `curadoria/{slug}/rerun_N/`.

### Modo F — `single-prompt` (chamado pela skill /gerar-post — integração)

Modo cirúrgico pra gerar **1 imagem específica** a partir de descrição pronta da skill `/gerar-post`. Diferente do Modo A (batch geral), aqui o input já vem pronto.

**Quando é invocado:** quando a `/gerar-post` está produzindo imagens pra um post e detecta que falta imagem (não há existente que sirva). O input é um bloco `DESCRIÇÃO PRONTA PRA /gerar-imagem` extraído do `producao.md`.

**Inputs esperados:**
- **Prompt completo** (entre aspas triplas no formato Mahou Prints)
- **Produto envolvido** (slug — pra puxar referência do produto)
- **Cenário** (do template.json — wooden_warm_cozy, dark_moody_premium, etc)
- **Pasta de saída** — `content/instagram/posts/{post-slug}/imagens/variacoes/`
- **Nome do arquivo final** (ex: `slide1_hero_var{N}.jpeg`)
- **Quantidade** — geralmente x4 (padrão) ou x1 (se quer rápido)

**Fluxo do Modo F:**

1. **Setup do Flow** (skip se já aberto)
2. **Verifica config** (Nano Banana Pro + 1:1 + x4 default)
3. **Upload BATCH** (2 arquivos):
   - Background do cenário correto (`content/imagegen/templates/cenas/{cena}/background.jpeg`)
   - Imagem de referência do produto (`Documents/Mahou Prints/products/{slug}/referencias/*` ou imagem existente)
4. **Anexa ingredientes via "Incluir no comando"** (ordem: background primeiro, produto segundo)
5. **Digita o prompt** (parágrafo único, sem `\n` — usar separadores tipo "CAMERA:", "LIGHTING:", "PRODUCT:")
6. **Gera** (Enter)
7. **Espera download das 4 variações**
8. **Salva** em `content/instagram/posts/{post-slug}/imagens/variacoes/` com nomes `{slide-name}_var{1-4}.jpeg`
9. **Retorna lista de paths** pra `/gerar-post` atualizar o producao.md

**Diferenças Modo F vs Modo A:**
| Aspecto | Modo A (batch geral) | Modo F (single-prompt) |
|---|---|---|
| Input | Lista de produtos novos | 1 prompt pronto + cenário |
| Decisão de cenário | Skill decide | Já vem definido |
| Output | products (em revisão)/{slug}/ | posts/{post-slug}/imagens/variacoes/ |
| Curadoria | Posterior | Próximo passo é curadoria imediata pelo usuário |
| Quantidade | 5-12 imagens/produto | 4 variações pra 1 imagem |

**Importante — não duplicar trabalho:** ANTES de chamar Modo F, a `/gerar-post` já verificou se há imagem reusável em `Documents/Mahou Prints/products/{slug}/`. Modo F só é chamado quando confirmado que precisa gerar nova.

### Modo G — `fila-hub` (integração MCP — produtos do Hub pendentes de imagem)

Modo que **integra a skill com o backend do Mahou Hub via MCP**. Lista produtos cadastrados que estão prontos pra gerar imagem (com inspiração/modelo 3D mas sem foto final) E produtos prontos pra anunciar (com imagem gerada mas ainda não anunciados). Workflow completo: lista → você escolhe → skill gera → upload pro Hub.

**Quando invocar:** "puxa fila do hub", "que produtos faltam imagem?", "produtos prontos pra anunciar", "lista pendentes".

**Pré-requisitos:**
- MCP server `mahou-hub` ativo (`.mcp.json` configurado + token em `mcp-servers/mahou-hub/.env.local`)
- Sessão Claude rodando dentro do repo `mahou-hub/` OU com MCP configurado globalmente no Claude Desktop
- Tools `mcp__mahou-hub__*` disponíveis (testa pedindo "quantas oportunidades temos")

**Fluxo do Modo G:**

#### G.1 — Levantamento de estado (chama MCP)

Chamadas paralelas:
- `mcp__mahou-hub__listar_produtos_pendentes_imagem({ pageSize: 50 })` → Categoria A
- `mcp__mahou-hub__listar_produtos({ anunciado: 'false', temImagens: 'true', pageSize: 50 })` → Categoria B
- (opcional) `mcp__mahou-hub__listar_produtos({ anunciado: 'false', temReferencia: 'false', pageSize: 50 })` → Categoria C (sem referência — bloqueada)

#### G.2 — Apresentação ao usuário

Tabelas separadas por categoria:

```
📋 Estado do catálogo (Mahou Hub)

🟡 CATEGORIA A — Pendentes de imagem (N produtos)
   Têm referência, ainda não têm foto final. Candidatos diretos pra geração.

   | # | Nome | Cor/Filamento | Refs | Cena sugerida (auto) |
   |---|------|---------------|------|----------------------|
   | 1 | Porta Escova de Dente | Preto matte | 2 INSPIRACAO | bathroom_modern_black_marble |
   | 2 | Suporte para Mug | Branco translúcido | 1 INSPIRACAO + URL 3D | wooden_warm_cozy |
   ...

✅ CATEGORIA B — Prontos pra anunciar (M produtos)
   Têm imagem gerada e anunciado=false. Só falta publicar no marketplace.

   | # | Nome | Imagens | Canal principal | Última atualização |
   |---|------|---------|-----------------|--------------------|
   | 1 | Suporte Mobile Bebê | 3 GERADAS | SITE | há 3 dias |
   ...

⚠️  CATEGORIA C — Bloqueados (K produtos, opcional listar)
   Sem referência cadastrada. Precisa upload de inspiração no Hub antes.
```

Pergunta direta: **"Quais quer gerar agora? Categoria A: 1, 2, todos, ou nenhum?"**

#### G.3 — Pra cada produto selecionado

1. **Buscar detalhe**: `mcp__mahou-hub__obter_produto({ id })` — pega nome, dimensões, filamento, URLs de referências, modelo3dUrl, descrição da inspiração.

2. **Slugify nome**: `Porta Escova de Dente` → `porta-escova-dente`.

3. **Criar pasta local**: `Documents/Mahou Prints/products (em revisão)/<slug>/` + `referencias/`.

4. **Baixar referências do Hub**: `curl -L -o referencias/inspiracao_N.jpg https://media.mahouprints.com/<arquivo>` (URLs vêm absolutas do `obter_produto`).

5. **Salvar `_meta.json`** com:
   ```json
   {
     "produtoId": "cuid-do-hub",
     "nome": "Porta Escova de Dente",
     "filamento": "PLA Preto Matte",
     "dimensoes": "8x4x12 cm",
     "cenarioEscolhido": "bathroom_modern_black_marble",
     "criadoEm": "2026-05-23T..."
   }
   ```

6. **Heurística de cenário** (consulta `content/imagegen/templates/template.json`):
   - Aplica `mapeamento_produto_cena` cruzando palavras-chave do nome com `categorias_produto` de cada cena
   - Ex: "porta-escova" / "suporte papel higiênico" → `bathroom_modern_black_marble`
   - Ex: "abajur" / "luminária" → `dark_moody_premium`
   - Ex: produto decorativo genérico → `wooden_warm_cozy` (default)
   - **Se ambíguo (mais de 1 cena candidata ou nenhuma)**: pergunta ao usuário pra esse produto

7. **Invocar Modo F**: passa prompt montado (template padrão Mahou + dados do produto) + cenário + slug + pasta `Documents/Mahou Prints/products (em revisão)/<slug>/variacoes/`.

8. **Aguarda 4 variações** geradas pelo Modo F.

9. **Pergunta qual aprovar**: "var1/var2/var3/var4? (ou 'regerar')"

#### G.4 — Após aprovação (auto-upload + salva local)

Pra cada produto aprovado:

1. **Salva final local**: copia variação escolhida pra `Documents/Mahou Prints/products/<slug>/hero.jpeg` + arquiva variações em `variacoes/`.

2. **Upload pro Hub (via curl multipart)**:
   ```bash
   source mcp-servers/mahou-hub/.env.local  # carrega MAHOU_API_TOKEN
   curl -X POST "$MAHOU_API_URL/api/v1/produtos/$PRODUTO_ID/imagens" \
     -H "Authorization: Bearer $MAHOU_API_TOKEN" \
     -F "arquivo=@Documents/Mahou Prints/products/<slug>/hero.jpeg" \
     -F "origem=GERADA"
   ```
   (Endpoint multipart — MCP tools não suportam upload de arquivo binário, então skill usa curl direto.)

3. **Atualiza `_meta.json`** marcando `imagemFinalSubidaPraHub: true` + timestamp.

4. **NÃO marca anunciado=true automaticamente**. Isso é ato deliberado humano após publicação real no marketplace. Skill só lembra:
   > "✅ N imagens uploaded pro Hub. Quando publicar no marketplace, roda `marcar produtos anunciados` com os ids: [...] pra fechar o loop."

#### G.5 — Resumo final

```
📊 Resumo da sessão

✅ Gerados + uploaded pro Hub:
   - Porta Escova de Dente (id: clxxx)
   - Suporte para Mug (id: clyyy)

⏭️  Pulados (você não escolheu):
   - 3 produtos da Categoria A

📋 Lembrete: 5 produtos na Categoria B já estão prontos pra anunciar.
   Não esquecer de marcar anunciado=true via `marcar_produtos_anunciados` após publicar.
```

**Critérios de match nome→cenário (heurística):**

| Palavra-chave no nome | Cenário sugerido |
|---|---|
| porta-escova, suporte-papel-higiênico, gancho-toalha, dispenser-sabonete, bandeja-sabonete, organizador-cosmético, cabide-toalha | `bathroom_modern_black_marble` |
| abajur, luminária, led, vela, porta-vela, difusor-luminoso, mobile-com-luz | `dark_moody_premium` |
| mobile-bebê, suporte-mobile-bebê, decoração-quarto-bebê, organizador-quarto-bebê | `nursery_soft_pastel` |
| (qualquer outro decorativo / organizador / cortador / contador / polaroid / vaso / brinquedo-pet / marca-página) | `wooden_warm_cozy` (default) |

**Caso o produto não case com nenhuma palavra-chave clara:** pergunta ao usuário antes de gerar.

**Limitações conhecidas do Modo G:**
- Não cria produto novo no Hub (use UI ou `mcp__mahou-hub__criar_produto` antes).
- Não faz upload de referências/inspirações pro Hub (só consome as que já estão lá).
- Não marca anunciado=true (decisão humana após publicação real).
- Cenário pode precisar ajuste manual em produtos atípicos (vide heurística acima).

### Modo E — `editar` (edição cirúrgica via Nano Banana — RECOMENDADO para ajustes pequenos)
Quando uma imagem ficou ÓTIMA mas tem 1 detalhe pra corrigir (ex: remover bebê, trocar cor de item, mudar pose, adicionar elemento), use o **modo Edit nativo do Flow** ao invés de regerar do zero. Vantagens:
- Preserva composição, luz, framing, forma — só altera o delta pedido
- Mais rápido (1 imagem por edição, ~30s)
- Resultado muito mais consistente que regerar
- Múltiplas edições podem ser encadeadas (cascade)

Use sempre que: já tem uma imagem boa + ajuste pequeno/cirúrgico. NÃO use pra mudanças radicais (cor totalmente diferente, cena nova) — pra isso volte ao Modo A.

### Modo D — `batch-autonomo` (RECOMENDADO para anúncios — meta 5 imagens ótimas/produto)
Processa **automaticamente** todos os produtos pendentes em `C:\Users\PC\Documents\Mahou Prints\products (pendente)\`. Para cada produto:
- **Verificar primeiro** se já está em `products (em revisão)/` ou `products/` (slug equivalente) — se sim, PULA e **apaga a pasta de pendente**
- Interpreta nome + refs (multimodal) pra entender função
- Define cenários distintos pra anúncios (vários ângulos, em uso, detalhe)
- Novo projeto Flow
- Gera **5 imagens ótimas** (não 12 — meta reduzida). Cobertura:
  - Vários ângulos/lados do produto sozinho (1-2 imgs)
  - Produto em uso/contexto real (1-2 imgs)
  - Macro detalhe (1 img)
- Salva em `products (em revisão)/{slug}/`
- **Ao terminar:** apaga projeto Flow (botão delete no dashboard) pra não lotar a aba
- **Antes de apagar projeto:** salvar localmente as imagens que serão usadas como ref em projetos futuros (ex: hero gerada pra iterar em outro produto similar)
- **Após salvar em revisão:** apagar pasta correspondente em `products (pendente)/` (já foi processada)
- Sem feedback intermediário entre cenários

**Estratégia de seleção (5/8 ou 5/12):**
- 1 geração x4 + 1 geração x4 = 8 imgs → escolher 5 melhores
- Ou 2-3 gerações com cenários diferentes, escolher melhores de cada

**Limpeza obrigatória após cada produto:**
1. Imagens salvas em em-revisão/{slug}/ ✓
2. Apagar projeto Flow do dashboard ✓
3. Apagar pasta {slug-original} em pendente/ ✓

Se ambíguo, perguntar. Default: se usuário diz "gera imagens dos produtos pendentes" / "automatiza", use Modo D.

---

## Modo A — `gerar` (geração em batch)

### A.1 Coleta inicial
Leia `content/imagegen/templates/template.json` e `content/imagegen/feedback/historico.json`.

Pergunte ao usuário:
- **Lista de produtos** (slug + descrição/refs + cor/filamento) — pode ser 1 ou N
- **Cena padrão** pra todos (geralmente `wooden_warm_cozy` por enquanto)
- Por produto: caminho da(s) imagem(ns) de referência

Se forem N produtos similares, ofereça batch automático. Se forem muito diferentes (cenas/cores diferentes), processe um por vez mas sem pedir feedback entre eles.

### A.2 Setup do Flow (uma vez por sessão)
Abra https://labs.google/fx/pt/tools/flow. Login manual se necessário.

### A.3 Para CADA produto da lista:

#### Criar projeto Flow novo
- Click "Novo projeto" → captura o `project_id` da URL `/project/{uuid}` (vai pra `_meta.json`)

#### Upload BATCH (1 chamada, 2 arquivos)
```javascript
await browser_file_upload({paths: [
  "C:\\Users\\PC\\ImageGen\\templates\\cenas\\{cena}\\background.jpeg",
  "{caminho-da-referencia-produto}"
]});
```
Espera ~3s. Ambos aparecem na grade.

#### Verificar config (skip se já correto)
Antes de mexer no botão de modelo, leia o texto. Se já mostrar `🍌 Nano Banana Pro crop_square x4`, **pule a config inteira**. Senão:
- Click no botão de modelo
- Click aba `1:1` (crop_square)
- Click aba `x4`
- Click `arrow_drop_down` do nome do modelo
- Click `🍌 Nano Banana Pro`
- `Escape` pra fechar

#### Anexar ingredientes + digitar prompt — MÉTODO RECOMENDADO ("Incluir no comando")

**NÃO use o menu `@`** — sujeito a overlap visual quando há muitas thumbs. Use o método "Incluir no comando" via toolbar do thumb:

1. Pra cada ref (ordem: **background primeiro, produto segundo**):
   - `browser_hover` no thumb (`a[href*="<media_id_link>"]`) — revela toolbar
   - `browser_click` no `more_vert` que aparece (`a[href*="<id>"] >> .. >> button:has-text("more_vert")`)
   - `browser_click` no menuitem `[role="menuitem"]:has-text("Incluir no comando")`

2. Os chips aparecem **ANTES do textbox** (FORA do Slate editor) como botões com thumbnail miniatura — NÃO ficam dentro do conteúdo do prompt textual.

3. Depois disso, click no textbox e use `browser_type` (que usa `fill()`) — agora seguro, porque `fill()` substitui só o conteúdo do Slate e os chips estão FORA dele.

**CRÍTICO:** NÃO use `\n` ou quebras de linha no prompt — o Slate editor do Flow trava com `Application Error: client-side exception`. Use **parágrafo único contínuo** com separadores tipo "CAMERA AND LENS:", "PRODUCT:", "LIGHTING:", "AVOID:".

**Identificando o thumb:** após upload, pegue os media_ids via:
```javascript
browser_evaluate({function: `() => JSON.stringify(
  Array.from(document.querySelectorAll('a[href*="/edit/"]'))
    .map(a => ({href: a.href, img: a.querySelector('img')?.src}))
)`})
```
- `href` link → media_id "canônico" (use pra hover seletor)
- `img.src` (formato `?name=<uuid>`) → media_id "thumbnail" (use pra coletar URL CDN depois)

**Por que esse método é melhor:**
- Não passa pelo menu `@` (que tem overlap quando há muitas thumbs)
- Chips ficam fora do Slate → `fill()` do `browser_type` não os apaga
- Funciona idêntico para uploads E para variações geradas anteriores (ambos têm toolbar idêntica)
- Suporta o **fluxo iterativo (img2img)** do Modo C — basta usar uma variação anterior como ref segunda

**Prompt template** — VALIDADO em 2026-05-16 — converge em 1 rodada com produto preto. Use texto contínuo (sem `\n`):

```
Close-up product photography hero shot of a [PRODUTO_descrição] placed on the wooden table in the Mahou Prints studio scene from the first reference image. Use the form and shape from the second reference image. Keep the same background scene (logo wall reading 'Mahou Prints', plant in white pot, books) but as soft blurred bokeh context. Keep the EXACT logo text 'Mahou Prints' unchanged.

CAMERA AND LENS: Shot on a Sony FE 90mm f/2.8 macro G OSS lens at f/2.8 aperture, ISO 200. Tight product framing — the [PRODUTO] fills 65-70% of the frame, camera positioned approximately 30cm from the product. Shallow depth of field: only the product is tack-sharp, background gently blurred. Premium commercial product photography. Slight 3/4 angle, standing upright on the table.

PRODUCT: [descrição completa: forma, partes, dimensões reais ex. 28cm tall]. Color: [filamento.descricao do template.json]. [Status: e.g. "The stand is EMPTY — no controllers, no headset displayed."]

FDM SURFACE (real geometric layer lines captured by macro lens): Each 0.2mm horizontal ring is REAL 3D micro-geometry — a physical stepped ridge from layer-by-layer FDM additive manufacturing. The macro lens at f/2.8 captures every ridge: a thin highlight along the top edge of each layer, a subtle shadow recess in the gap between layers. Direction: STRICTLY HORIZONTAL lines, parallel to the wooden table, perpendicular to the vertical axis of the [PRODUTO]. On all side walls and curved surfaces — clear horizontal contour-line stripes (all horizontal, never circular). NEVER concentric circles on side walls. NEVER vertical lines. Concentric circles ONLY on the flat horizontal top of the base plate. One thin vertical z-seam stripe down one side.

LIGHTING: Warm cozy key light from upper-front (matching background scene) PLUS a hard RAKING SIDELIGHT from low camera-left at approximately 15 degree grazing angle — this raking light reveals every layer ridge by creating micro-highlight and shadow contrast across the surface. Slight rim light on curves. The grazing light is what makes the FDM texture READ AS 3D GEOMETRY, not flat decal texture.

Finish: [tecnico_fdm.finish]

AVOID: NO glossy/wet/injection-molded plastic look. NO smooth resin/SLA seamless surface. NO flat painted/applied "layer line" texture without depth. NO concentric circles or spiral patterns on side walls or curved surfaces. NO vertical brushed lines. NO vinyl-grooves look on curves. NO uniform circular texture wrapping the form. NO wide environmental framing — product must be close and dominant. Layer lines are stacked horizontal physical ridges with micro-shadow between, never flowing with curvature.
```

Para produtos com forma complexa, recomende ao usuário fornecer múltiplos ângulos de referência. Para produtos pretos/escuros: (a) reforce "EXACT logo text 'Mahou Prints' unchanged", (b) Nano Banana resiste a colocar layer lines no preto matte (contraste mínimo) — compensar com ênfase em raking light e "real 3D geometry with highlight/shadow per layer".

**Por que esses blocos são necessários:**
- **FRAMING:** sem ele, Nano Banana faz "foto de ambiente com produto pequeno" em vez de "produto em close-up com contexto". Aprendizado de 2026-05-16 (sessão suporte-controle-ps5 rodadas 1-3).
- **CRITICAL — layer lines com profundidade:** sem isso, ou (a) Nano Banana aplica círculos concêntricos (top_surface) nas laterais curvas, ou (b) apaga as layer lines (resultado SLA-like liso), ou (c) faz textura plana decalque. A chave é "real 3D geometry" + raking light criando highlight/shadow por camada.

#### Disparar geração + esperar (com `wait_for text`)
```javascript
await browser_click({target: 'arrow_forward Criar'});
await browser_wait_for({text: 'redo Reutilizar comando', time: 90});  // texto que só aparece após geração
```

Não use `wait_for time: 25` fixo — desperdiça segundos quando geração termina antes.

#### Coletar URLs CDN + download paralelo (~5s pras 4)

```javascript
const result = await browser_evaluate({function: `async () => {
  // Filtra apenas variações geradas (1024x1024 do Nano Banana 1K)
  // Ingredientes têm dimensões diferentes (ex: 5504x4128 do background)
  const imgs = Array.from(document.querySelectorAll('img[alt="Imagem gerada"]'))
    .filter(img => img.naturalWidth === 1024 && img.naturalHeight === 1024);

  // Cada src é URL trpc: /api/trpc/media.getMediaUrlRedirect?name=<UUID>
  // Redireciona 307 pra URL CDN: https://flow-content.google/image/<UUID>?Expires=...&Signature=...
  // CDN signature é pública por horas → curl baixa sem auth

  const getCdnUrl = (trpcUrl) => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', trpcUrl, true);
    xhr.responseType = 'blob';
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 2) {  // HEADERS_RECEIVED — responseURL já tem CDN
        const finalUrl = xhr.responseURL;
        const mediaId = trpcUrl.split('name=')[1];
        xhr.abort();
        resolve({mediaId, cdnUrl: finalUrl});
      }
    };
    xhr.onerror = () => resolve(null);
    xhr.send();
  });

  return JSON.stringify(await Promise.all(imgs.map(img => getCdnUrl(img.src))));
}`});
```

Resultado: array de `{mediaId, cdnUrl}` (4 itens). **Guarde os `mediaId`** — vão pro `_meta.json` pra permitir reabrir/iterar.

Bash em paralelo:
```bash
OUT="C:/Users/PC/Documents/Mahou Prints/curadoria/{slug}"
mkdir -p "$OUT/referencias"
curl -sSL -o "$OUT/variacao_1.jpeg" "$URL1" &
curl -sSL -o "$OUT/variacao_2.jpeg" "$URL2" &
curl -sSL -o "$OUT/variacao_3.jpeg" "$URL3" &
curl -sSL -o "$OUT/variacao_4.jpeg" "$URL4" &
wait
cp "{caminho-da-ref}" "$OUT/referencias/"
```

#### Salvar `_meta.json` (template)
```json
{
  "produto": "{slug}",
  "data_geracao": "YYYY-MM-DD",
  "status": "aguardando_curadoria",
  "flow_project_url": "https://labs.google/fx/pt/tools/flow/project/{project_id}",
  "flow_project_id": "{project_id}",
  "cena": "{cena_slug}",
  "filamento": "{filamento_slug}",
  "modelo": "🍌 Nano Banana Pro",
  "proporcao": "1:1",
  "prompt": "{prompt usado, completo}",
  "referencias": ["referencias/{nome-arquivo-ref}"],
  "variacoes": {
    "variacao_1.jpeg": {"flow_media_id": "{uuid}", "aprovada": null, "feedback": ""},
    "variacao_2.jpeg": {"flow_media_id": "{uuid}", "aprovada": null, "feedback": ""},
    "variacao_3.jpeg": {"flow_media_id": "{uuid}", "aprovada": null, "feedback": ""},
    "variacao_4.jpeg": {"flow_media_id": "{uuid}", "aprovada": null, "feedback": ""}
  },
  "rodadas": [
    {"rodada": 1, "data": "YYYY-MM-DD", "prompt_resumo": "geração inicial"}
  ]
}
```

#### Salvar `_curadoria.md` (template do checklist)
```markdown
# Curadoria — {produto-slug}

**Gerado em:** YYYY-MM-DD
**Projeto Flow:** https://labs.google/fx/pt/tools/flow/project/{project_id}
**Cena:** {cena} | **Filamento:** {filamento}

Marque cada variação como `✅` (aprovar) ou `❌` (rejeitar). Pode adicionar comentário/feedback livre embaixo.

## Variações

- [ ] **variacao_1.jpeg** — _____________________________
- [ ] **variacao_2.jpeg** — _____________________________
- [ ] **variacao_3.jpeg** — _____________________________
- [ ] **variacao_4.jpeg** — _____________________________

## Hero (escolha 1 entre as aprovadas)
hero = _________ (ex: variacao_2.jpeg)

## Feedback geral / Ajustes pra próxima rodada
(deixe vazio se tá tudo bom)

```

#### Fim do produto, próximo do batch
Sem mostrar imagens, sem perguntar feedback. Loga no console "✅ {slug} gerado, salvo em curadoria/{slug}/". Vai pro próximo.

### A.4 Fim do batch
Resumo curto:
```
✅ Batch concluído. N produtos gerados.

Próximo passo: revisar em C:\Users\PC\Documents\Mahou Prints\curadoria\
Quando estiver pronto, me chame com "/gerar-imagem curar" ou cite os slugs.
```

Atualize `content/imagegen/feedback/historico.json` com a sessão (1 entry por produto).

---

## Modo B — `curar` (revisão das pendentes)

### B.1 Listar pendentes
Liste subpastas em `C:\Users\PC\Documents\Mahou Prints\curadoria\`. Mostre ao usuário quantos produtos têm pendentes e quais.

Se usuário citou produto específico (`/gerar-imagem curar suporte-controle-ps5`), pule a listagem.

### B.2 Para cada produto a curar
1. Leia `_meta.json` e `_curadoria.md`
2. Use `Read` tool nas 4 imagens (multimodal — mostra ao Claude)
3. Se `_curadoria.md` ainda está em branco (template original): mostre as imagens e peça avaliação ao vivo (skill volta a perguntar como antes)
4. Se `_curadoria.md` foi editado pelo usuário (tem `[x]`, `[X]`, ou comentários): leia o estado dele e processe

### B.3 Processar aprovações
Pra cada variação marcada ✅:
- Copie de `curadoria/{slug}/variacao_N.jpeg` → `products/{slug}/variacao_N.jpeg`
- Atualize `_meta.json.variacoes[variacao_N].aprovada = true`

Hero:
- Se `hero = variacao_X.jpeg` declarado, copie como `products/{slug}/hero.jpeg`
- Senão, use a primeira aprovada

Crie `products/{slug}/_meta.json` (mesma estrutura, com `status: "aprovado"`).

### B.4 Processar rejeições / pedidos de ajuste
Se há `❌` ou comentários em "Feedback geral":
1. Confirme com o usuário se ele quer regenerar (auto mode: regere automaticamente)
2. Reabra o projeto Flow pelo `flow_project_url` do `_meta.json`
3. Use o "Reutilizar comando de texto" no projeto pra recarregar prompt original
4. Ajuste o prompt com o feedback do usuário (incremente)
5. Click Criar → gera nova rodada de 4
6. Baixa nova rodada em `curadoria/{slug}/rerun_2/` (incrementa o número)
7. Adiciona entrada em `_meta.json.rodadas`
8. Cria novo `_curadoria.md` (ou anexa seção `## Rodada 2`)

### B.5 Limpar curadoria
Se TODAS as variações de um produto foram processadas (aprovadas ou rejeitadas com nova rodada gerada), pergunte se quer apagar a pasta `curadoria/{slug}/`. Auto: deixa pasta com `_meta.json` atualizado (`status: "aprovado"` ou `status: "rerun_pendente"`).

---

## Modo E — `editar` (edição cirúrgica via "O que você quer mudar?")

Pipeline pra edição de UMA imagem específica via Flow nativo.

### E.1 Identificar a imagem-base
Pode vir de:
- Pasta `products (em revisão)/{slug}/` (após gerar pelo Modo D)
- Pasta `curadoria/{slug}/` (Modo A)
- Cenário recém-gerado (ainda no projeto Flow)
- Print/screenshot que o usuário mandou (vai precisar fazer upload primeiro)

Você precisa do **media_id** dela no Flow. Se foi gerada por você, está em `_meta.json.cenarios.{N}.media_ids`. Se foi upload externo, faz upload primeiro.

### E.2 Abrir modo Edit do Flow
Navegar para a URL específica da imagem:
```
https://labs.google/fx/pt/tools/flow/project/{project_id}/edit/{media_id}
```
A página abre com a imagem em destaque + um campo de texto **"O que você quer mudar?"** + botão "Criar". Esse campo é img2img nativo — sub-prompt curto.

### E.3 Digite o prompt de edição (curto, focado, em inglês)

Princípios:
- **Curto:** 1-3 frases focadas só na mudança
- **Específico:** "remove the sleeping baby from the crib" > "remove the baby"
- **Preserve o resto:** "Keep everything else identical — the bracket, the mobile, the lighting, the scene"
- **Substituição:** ao remover algo central, descreva o que vai no lugar ("replace with empty gray star-pattern baby nest")

Exemplos comuns:
- "Remove the sleeping baby from the crib. Replace with an empty gray star-pattern baby nest, a folded striped blanket, and a small plush bear. Keep everything else identical."
- "Change the controller color from white to red, but keep the same model, pose, lighting, and scene."
- "Add a small Polaroid photo on the table next to the product showing the Mahou Prints logo. Keep everything else exactly as it is."
- "Remove the text watermark in the bottom-right corner."

### E.4 Click Criar
O Flow gera **1 imagem** (não x4) pela edição. Aguardar ~30s. Resultado fica como nova media_id no projeto.

### E.5 Coletar URL CDN + baixar
Mesma técnica do Modo A:
```javascript
// Coletar a nova media_id (será a mais nova 1024×1024 que não estava antes)
const newImg = Array.from(document.querySelectorAll('img[alt="Imagem gerada"]'))
  .filter(i => i.naturalWidth === 1024 && !window.__preGenIds.has(i.src.split('name=')[1]))[0];
// XHR pra resolver redirect → CDN URL → curl
```

Salvar substituindo o arquivo original (ex: `cenario2_uso_var1.jpeg` → editada) OU como `cenario2_edited_var1.jpeg` se quiser manter histórico.

### E.6 Atualizar `_meta.json`
Adicionar campo `edicoes` por imagem:
```json
"variacoes": {
  "cenario2_uso_var1.jpeg": {
    "flow_media_id_original": "016ca259-...",
    "flow_media_id_editada": "<nova_id>",
    "edicao_prompt": "Remove the sleeping baby...",
    "data_edicao": "YYYY-MM-DD"
  }
}
```

### E.7 Edições em batch (4 imagens do mesmo cenário)
Pra editar todas as 4 variações de um cenário com a mesma instrução:
- Loop pelas 4 media_ids
- Para cada uma: navegar → digitar prompt → criar → coletar URL → curl → salvar
- Total: ~4-5 minutos pra 4 edições

---

## ⚠️ PROTOCOLO DE QUALIDADE (OBRIGATÓRIO — aplica-se a TODOS os modos)

Definido pelo usuário em 2026-05-17 após apagar 3 produtos em revisão por incongruência com refs reais.

### Q1. Fidelidade máxima à referência
Imagens geradas DEVEM se parecer com o produto real. Forma, cor, padrão, textura, proporções — tudo. **Não podemos anunciar produto diferente do real.** Discrepância = rejeitar/corrigir.

### Q2. Limite de 8 gerações por projeto Flow
Cada projeto Flow acumula contexto que pode degradar qualidade do Nano Banana. Pra 12 imagens base: 3 gerações iniciais + até 5 correções via Modo E.

**Quando atingir 8 gerações no projeto:**
1. Salvar as melhores imagens APROVADAS localmente
2. Criar NOVO projeto Flow
3. Fazer upload das novas como refs (e da ref original)
4. Apagar projeto antigo (do Flow — botão delete no dashboard)
5. Continuar a partir do novo projeto

Contar gerações via `_meta.json.generations_count` e atualizar ao longo do trabalho.

### Q3. Polimento da imagem-referência antes de iterar
Se você vai usar uma imagem gerada como REF (img2img iterativo) na próxima rodada, **POLIR ela antes** via Modo E:
- Identificar pequenos defeitos (artefato, layer line errada, cor levemente off)
- Aplicar Modo E com prompt curto: "Fix the [defeito] while keeping everything else identical"
- Aprovar a versão polida
- USAR essa versão polida como ref na próxima rodada

Senão: defeitos da ref se propagam multiplicadamente nas próximas gerações.

### Q4. Revisão obrigatória pós-geração (auto-revisão antes do usuário ver)

Para CADA imagem antes de salvar em `products (em revisão)/`:

```
Para cada imagem gerada (4 por geração × 3 cenários = 12):
  1. Read multimodal da imagem-ref ORIGINAL do produto
  2. Read multimodal da imagem GERADA
  3. Comparar mentalmente: forma, cor, padrão, proporções batem?
  4. Se sim → manter, vai pra revisão do usuário
  5. Se não → aplicar Modo E com prompt focado na divergência
     ex: "The mesh lattice pattern on the bowl is too coarse — make it finer with smaller diamond cells, matching the reference. Keep everything else identical."
  6. Re-revisar a versão editada
  7. Só salvar em em-revisão/ depois de passar nesse check
```

Esse check é OBRIGATÓRIO mesmo em batch autônomo (Modo D). Aumenta tempo total mas é não-negociável.

### Q5. Documentar edições em `_meta.json`
Toda imagem que passou por Modo E deve ter campo:
```json
"variacao_1.jpeg": {
  "flow_media_id": "...",
  "edicoes": [
    {"data": "YYYY-MM-DD", "prompt": "Fix the X...", "motivo": "Polimento antes de usar como ref"},
    {"data": "YYYY-MM-DD", "prompt": "Adjust the Y...", "motivo": "Auto-revisão Q4"}
  ]
}
```

---

## Modo D — `batch-autonomo` (anúncios — 12 imagens por produto)

Pipeline autônomo para gerar imagens de marketing/anúncios. Default para múltiplos produtos novos.

### D.1 Descobrir produtos pendentes

```bash
ls "C:/Users/PC/Documents/Mahou Prints/products (pendente)/"
```
Cada subpasta = 1 produto. Dentro deve haver `Referências/` (ou `referencias/`) com 1+ imagens do produto.

### D.2 Para CADA produto

#### D.2.1 Interpretar (multimodal)
- Leia todas as imagens em `{produto}/Referências/` via `Read` tool (Claude vê)
- Combine com o nome da pasta pra inferir:
  - **O que é** o produto
  - **Pra que serve** (caso de uso primário)
  - **Variantes** (com/sem tampa, cores, etc.)
  - **Cor/material** dominante

#### D.2.2 Definir 3 cenários distintos
Pense em 3 fotos de anúncio que dariam pra esse produto:

| Cenário | Foco | Exemplo (cesta) | Exemplo (brinquedo gato) | Exemplo (suporte mobile) |
|---|---|---|---|---|
| **1. Hero** | produto isolado, destacado | cesta vazia, padrão lattice em evidência | anel completo top-down, bolinha em foco | suporte branco em fundo neutro, mostrando a forma do conector e parafuso |
| **2. Em uso** | função/caso real | cesta cheia de chaves/AirPods/óculos | gato batendo na bolinha, ela girando | instalado no berço com mobile pendurado, bebê no nido |
| **3. Detalhes/variante** | close-up ou variante | versão com tampa, ângulo 3/4 | close-up da bolinha + textura FDM | macro do parafuso de aperto sendo girado, mãos instalando |

Você decide os 3 cenários com base no produto. Os 3 devem ser **visualmente distintos** (ângulo, contexto, ou função).

#### D.2.3 Slug (nome de pasta limpo)
Converta nome da pasta original pra slug:
- `Brinquedo de Gato` → `brinquedo-gato`
- `Cesta Decorativa` → `cesta-decorativa`
- `Suporte Mobile de bebe` → `suporte-mobile-bebe`

Sem acentos, espaços → hífen, lowercase.

#### D.2.4 Fluxo de geração (3 rodadas no mesmo projeto Flow)

1. Navegar até a dashboard Flow e click "Novo projeto" → captura `project_id`
2. Upload batch: `setFiles([background.jpeg, ref1.jpg, ref2.jpg, ...])` em UMA chamada
3. Wait 3s, verificar config Pro+1:1+x4 (skip se já correto)

Para cada um dos 3 cenários:
- **Anexar refs via "Incluir no comando"** (ver seção 3.4): background primeiro, depois 1-2 refs do produto mais relevantes para o cenário
- Click no textbox → `browser_type` o prompt do cenário (texto contínuo, sem `\n`)
- Click Criar
- `browser_wait_for` esperando geração (~30s)
- Coletar URLs CDN de **apenas as 4 novas** (filtre pelo `__preGenIds` capturado antes)
- Curl paralelo → salvar como `cenario{N}_var{1-4}.jpeg` em `products/{slug}/`
- **IMPORTANTE:** ENTRE cenários, sair do menu se aberto + apagar chips do prompt anterior usando o botão "close Apagar comando", reanexar refs apropriadas pro próximo cenário

#### D.2.5 Estrutura final salva (após cada produto)

Salvar em `products (em revisão)/{slug}/` — NÃO em `products/` direto. O usuário revisa e move manualmente se aprovado.

```
C:\Users\PC\Documents\Mahou Prints\products (em revisão)\{slug}\
├── cenario1_hero_var1.jpeg
├── cenario1_hero_var2.jpeg
├── cenario1_hero_var3.jpeg
├── cenario1_hero_var4.jpeg
├── cenario2_uso_var1.jpeg
├── cenario2_uso_var2.jpeg
├── cenario2_uso_var3.jpeg
├── cenario2_uso_var4.jpeg
├── cenario3_detalhe_var1.jpeg
├── cenario3_detalhe_var2.jpeg
├── cenario3_detalhe_var3.jpeg
├── cenario3_detalhe_var4.jpeg
├── referencias\
│   └── {refs originais copiadas}
└── _meta.json
```

`_meta.json` para Modo D inclui os 3 cenários + 12 media_ids:
```json
{
  "produto": "{slug}",
  "nome_original": "Cesta Decorativa",
  "data_geracao": "YYYY-MM-DD",
  "status": "gerado_automatico",
  "modo": "D-batch-autonomo",
  "flow_project_url": "...",
  "flow_project_id": "...",
  "interpretacao": "Bowl decorativo lattice mesh preto matte para organizar pequenos itens (chaves, AirPods, etc). Variante com tampa disponível.",
  "cenarios": {
    "hero": {"prompt": "...", "variacoes": ["cenario1_hero_var1.jpeg", ...], "media_ids": [...]},
    "uso": {"prompt": "...", "variacoes": [...], "media_ids": [...]},
    "detalhe": {"prompt": "...", "variacoes": [...], "media_ids": [...]}
  },
  "referencias_originais": ["ref1.jpg", "ref2.jpg"]
}
```

### D.3 Loop continuo
Após terminar 1 produto, **pula direto pro próximo** sem mostrar imagens nem perguntar feedback. Resumo final ao terminar TODOS:

```
✅ Batch concluído. N produtos × 12 imagens = N*12 imagens geradas.
- {slug1}: 12 imgs → products/{slug1}/
- {slug2}: 12 imgs → products/{slug2}/
- ...

Próximo passo: revisar manualmente em products/{slug}/.
Use modo C (iterar) se quiser regerar algum cenário com ajuste.
```

### D.4 Template de prompt por cenário (base reforjada — validada)

**Estrutura comum (em todos os 3 prompts):**
- Header: "Close-up product photography hero shot of [produto]..."
- Cena: "...placed in the Mahou Prints studio scene from the first reference image..."
- Logo intact: "Keep the EXACT logo text 'Mahou Prints' unchanged."
- CAMERA AND LENS: Sony FE 90mm f/2.8 macro G OSS @ f/2.8 ISO 200
- FRAMING: produto 65-70% do frame
- FDM SURFACE: real 3D geometry com highlight/shadow per layer
- LIGHTING: raking sidelight 15°
- FINISH matte PLA
- AVOID: NO concentric circles em curvas, NO vertical lines, NO smooth resin, NO wide framing

**Variação por cenário (delta):**
- **Hero:** "...presented as a clean product hero shot. The [produto] is empty/clean/in its default state. Centered, slight 3/4 angle."
- **Uso:** "...shown in actual use: [descrever uso real — gato batendo, cesta cheia com chaves AirPods controle de carro, suporte instalado em berço VAZIO com mobile pendurado, etc.]. The functional context is clear."
- **Detalhe:** "...close-up macro on [feature key — parafuso de aperto / textura mesh / track interno + bolinha]. Even tighter framing, ~85% of frame on the detail. Shallow DOF emphasizes the feature."

**REGRA CRÍTICA — NO BABIES/CHILDREN:**
Adicionar a TODOS os prompts (todos os cenários) no AVOID block:
```
NO babies, NO children, NO infant faces or bodies, NO toddlers. NO baby in the crib/scene.
```
Aplica especialmente a produtos infantis (mobile holder, brinquedos de bebê): cena de berço deve estar VAZIO (apenas cobertor dobrado, pelúcia, ou objetos inanimados). Mãos adultas em close-ups de instalação continuam OK (mostra função). Animais (gatos, etc) continuam permitidos. Razão: AI-gerados de bebês caem em uncanny valley e causam desconforto em anúncios.

## Modo C — `iterar` (refinamento iterativo IMG2IMG)

Use quando o usuário diz "gera mais variações do suporte-ps5, mas com X" ou após curadoria com variações boas mas que precisam de ajustes.

**Princípio fundamental:** a partir da rodada 2, NÃO usar mais a referência original do produto isolado. Em vez disso, usar **a melhor variação da rodada anterior como referência principal** + background da cena. O Nano Banana refina o que já está bom em vez de inventar de novo.

```
ROUND 1 (geração inicial — Modo A):
  refs = [background.jpeg, produto_referencia.jpg]
  prompt = template base com tecnico_fdm
  → gera 4 variações
  → usuário aponta a(s) melhor(es) na curadoria

ROUND 2+ (refinamento iterativo — Modo C):
  refs = [background.jpeg, melhor_variacao_da_rodada_N-1.jpeg]  ← MUDA AQUI
  prompt = "Use the second reference as EXACT BASE. Keep its form, pose,
            framing, FDM texture, lighting, all current details.
            ONLY change: [ajustes específicos do usuário]."
  → gera 4 novas variações refinadas na mesma direção
```

**Por que funciona:**
- Variação anterior já tem framing/forma/cena resolvidos → não precisa "reinventar"
- Mantém continuidade visual entre rodadas
- Prompt foca só nos deltas → menos conflito com instruções base
- Convergência em 1-2 rodadas vs 4-5 do fluxo antigo

**Passos detalhados:**

1. **Identificar a melhor variação anterior:**
   - Ler `_meta.json` da última pasta de curadoria/products do produto
   - Se `_curadoria.md` tem ✅: usar essa
   - Se múltiplas boas em aspectos diferentes: usar a mais alinhada com o ajuste pedido
   - Se ambíguo: perguntar (ou em auto, escolher a com melhor framing)

2. **Reabrir o projeto Flow** pelo `flow_project_url` (refs e variações antigas já estão no projeto)

3. **Anexar refs no campo de prompt:**
   - 1º `@` → escolher `background.jpeg` (mesma cena)
   - 2º `@` → escolher a variação anterior. No menu @, as variações aparecem como "Matte black gaming gear stand" (ou título genérico). Se ambíguo, navegue antes pra `/edit/{media_id}` desejado, copie URL, e o thumb correto fica em destaque no menu.

4. **Prompt curto, focado APENAS no delta:**
```
Use the second reference image as the EXACT BASE — keep its form, pose,
framing, scene, lighting, FDM texture (where already present), camera
angle, and all current visual details. The product is the same 3D-printed
matte black gaming gear stand placed in the same Mahou Prints studio scene.

ONLY MODIFY: [descrição precisa dos ajustes do usuário]

Common ajustes types:
- "Add clearly visible FDM layer lines with real 3D depth — horizontal
   micro-ridges across all side walls and the C-arch curve, each with a
   thin highlight on the top edge and shadow recess between. Use raking
   side light from low angle to reveal the stepped geometry."
- "Make the product slightly closer to the camera (fill 70% of frame
   instead of 50%)."
- "Add a Polaroid on the table behind the stand showing the brand logo."

AVOID changing: framing (unless requested), form, scene composition,
background, logo position. AVOID regenerating from scratch — REFINE the
second reference image.
```

5. **Click Criar** → wait_for text → coletar URLs CDN só das NOVAS → curl paralelo

6. **Salvar em `curadoria/{slug}-rerun{N+1}/`** com `_meta.json` apontando para a variação-base usada (`based_on: {pasta_anterior}/variacao_X.jpeg`)

**Quando NÃO usar refinamento iterativo:**
- Usuário rejeitou TODAS as variações da rodada anterior → volte ao Modo A (refs originais)
- Mudança radical na direção (cor/cena/forma muito diferentes) → Modo A
- Primeira rodada de um produto → sempre Modo A

**Histórico:** o `_meta.json` de cada rerun deve ter `based_on` apontando pra variação-base usada — útil pra rastrear convergência.

---

## Regras gerais

- SEMPRE peça permissão antes de baixar arquivos no Modo A se for batch grande (>5 produtos) — confirma escopo
- SEMPRE verifique `Nano Banana Pro + 1:1 + x4` antes de Criar (mas SKIP se já estiver setado)
- SEMPRE inclua detalhes técnicos FDM no prompt
- Use português (BR) com o usuário; prompts em inglês
- Se Playwright MCP falhar/timeout, oriente reiniciar Claude Code
- Backgrounds em `content/imagegen/templates/cenas/{cena}/background.jpeg`
- **No batch (Modo A): NÃO mostre imagens nem peça feedback entre produtos** — vai direto pro próximo
- **Filtre por dimensão 1024×1024 ao coletar URLs CDN** — ingredientes têm dimensões diferentes

## Otimizações de Performance

| Fase | Antes | Depois | Ganho |
|------|-------|--------|-------|
| Upload (2 arquivos) | 1m25s (2 ciclos) | ~30s (1 batch `setFiles`) | -55s |
| Config modelo | 50s (sempre) | 10s (skip se já set) | -40s |
| Wait pós-Criar | 25s fixo | ~15s (wait_for text) | -10s |
| **Download 4 imagens** | **~9 min (2K UI)** | **~5s (1K curl paralelo)** | **-8m55s** |
| Feedback inline | bloqueia próximo | Modo A não bloqueia | depende do batch |
| **TOTAL por produto** | **~14 min** | **~3-4 min** | **-70%** |

Para batch de N produtos: tempo ≈ N × 3-4min (vs N × 14min antes).

## Apêndice A — Fluxo legado 2K (sob demanda)

Se o usuário pedir explicitamente 2K (impressão grande, banner) em vez de 1K:
1. Navegue para `/edit/{flow_media_id}` da variação
2. Click "Baixar" → "2K Aumentada" → wait ~6s
3. **Mover IMEDIATAMENTE** o arquivo de `.playwright-mcp/Place_*.jpeg` pro destino final antes do próximo download (nome do arquivo inclui só minuto → 2 downloads no mesmo minuto se sobrescrevem)
4. Repetir pras outras

## Apêndice B — API direta upsampleImage (mapeada, não implementada)

Endpoint: `POST https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage`
- Body: `{mediaId, targetResolution: "UPSAMPLE_IMAGE_RESOLUTION_2K", clientContext: {recaptchaContext: {token}, projectId, tool: "PINHOLE", sessionId}}`
- Response: `{encodedImage: "<base64 2K>"}`
- Requer: `Authorization: Bearer ya29.<oauth_token>` + reCAPTCHA Enterprise token (uso único)
- Não implementado por fragilidade (auth + captcha). Documentado caso vire necessário no futuro.

## Apêndice C — Otimização: subagent paralelo (apenas no modo batch, 3+ produtos)

Durante a espera de ~30-35s da geração Nano Banana, há tempo ocioso. Pode-se spawnar um subagent Sonnet em paralelo (`Agent` tool, subagent_type=general-purpose, model=sonnet) para tarefas template-fill enquanto Playwright está ocioso:

```python
# Logo após click Criar, antes do wait_for:
Agent(
  subagent_type="general-purpose",
  model="sonnet",
  description="Metadata em paralelo",
  prompt="""Para o produto '{slug}' que acabou de ser disparado no Flow project {project_id}:
  1. Crie 'C:\\Users\\PC\\Documents\\Mahou Prints\\curadoria\\{slug}\\_meta.json' com schema padrão (template em SKILL.md), preenchido com {dados conhecidos}. Use null nas variacoes.flow_media_id e null em aprovada — vou preencher depois.
  2. Crie '_curadoria.md' usando o template padrão.
  3. Se rodada anterior em curadoria/, valide arquivos (jpeg válidos > 100KB, dimensões 1024×1024 via 'file' ou Python PIL).
  4. Atualize 'historico.json' adicionando entry desta rodada (sem media_ids ainda).
  
  Retorne sucintamente o que fez. Sem deixar tarefas pendentes."""
  run_in_background=False  # Bloquear até retornar
)
# Em paralelo: Playwright continua waitando geração
```

**Quando vale a pena:**
- Batch de 3+ produtos: ganho ~30s/produto × N produtos
- Único produto: NÃO vale (overhead de spawn > ganho)

**Quando NÃO usar:**
- Análise visual das imagens — REQUER o agente principal (multimodal + contexto)
- Reformular prompt após feedback — REQUER contexto da sessão
- Decisões sobre regerar/aprovar — REQUER usuário

**Aprendizado registrado:** o gargalo principal da skill NÃO é "tarefas pequenas" — é rodadas extras quando o prompt não acerta de primeira. Investir em memórias globais (framing close-up, layer depth, produto preto resistente) vale muito mais que delegar tarefas template-fill. Use o subagent paralelo só como ganho marginal em batch grande.

## Apêndice D — Configuração de perfil persistente do Chrome (opcional)

Pra evitar login manual a cada sessão, configure o Playwright MCP com `userDataDir` apontando pra um perfil persistente. Edite `~/.claude/settings.json` na seção do MCP playwright (verifique nome exato da config). Isso é fora do escopo desta skill — só recomendação.
