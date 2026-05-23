---
name: Mahou Prints — protocolo de qualidade e fidelidade
description: Regras OBRIGATÓRIAS pra geração de imagens — máxima semelhança com refs, limite de 8 gerações por projeto, polimento de ref antes de usar, revisão pós-geração comparada à ref
type: feedback
originSessionId: 1d7a4ea6-083d-46dc-aed3-dc4485ff12aa
---
Quatro regras INEGOCIÁVEIS pra a skill `/gerar-imagem` Mahou Prints:

### 1. Máxima fidelidade à referência
**As imagens geradas devem se parecer COM o produto real.** Não podemos anunciar produtos diferentes do que o cliente vai receber. Se a forma, cor, padrão, ou textura divergem da ref → REJEITAR a imagem (ir pra Modo E corrigir).

### 2. Limite de 8 gerações por projeto Flow
Para evitar exceder janela de contexto do Nano Banana e degradação de qualidade. Pra 12 imagens base, isso dá: 3 gerações iniciais (cenários hero/uso/detalhe) + até 5 correções via Modo E.

**Quando atingir 8 gerações:** salvar as melhores imagens locais como refs → criar NOVO projeto Flow → fazer upload das refs novas → apagar projeto antigo → continuar.

### 3. Polimento da imagem-referência antes de usar como ref iterativa
Se uma imagem gerada vai ser usada como REF na próxima rodada (img2img iterativo), primeiro polir ela via Modo E corrigindo defeitos pequenos. Senão os defeitos se propagam pras próximas gerações.

### 4. Revisão obrigatória pós-geração com comparação à ref
Antes de salvar imagens em `products (em revisão)/`:
- Para CADA imagem gerada, usar `Read` multimodal pra comparar com a(s) ref(s) original(is) do produto
- Se discrepância detectada (forma, cor, padrão): aplicar Modo E pra corrigir ANTES de salvar
- Só passa pra revisão do usuário se passar nesse check próprio

**Why:** Usuário (2026-05-17) apagou os 3 produtos em revisão por incongruências entre as imagens geradas e os produtos reais. "Não podemos de forma alguma anunciar produtos que não se pareçam com os reais". Sem essa checagem própria, defeitos sutis passam pra produção e prejudicam credibilidade.

**How to apply:**
- TODO produto novo na skill (Modo D especialmente) precisa passar pela revisão própria antes de ir pra `products (em revisão)/`
- Loop por produto: gerar 4 → comparar com ref → corrigir via E se preciso → próximo cenário
- Contar gerações no projeto Flow; trocar de projeto ao atingir 8
- Documentar em `_meta.json` as edições aplicadas (Modo E) e razões
