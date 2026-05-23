# Como treinar a skill `/gerar-descricao`

Esta pasta é o **cérebro de aprendizado** da skill. Quanto mais você alimenta, melhor ela fica.

## 📂 Estrutura

```
~/Marketplace/treino/
├── listings_que_funcionaram/        # 🟢 Seus exemplos de sucesso
│   ├── shopee/{produto}.md          # listings que venderam bem na Shopee
│   ├── mercado-livre/{produto}.md   # listings com bom CTR no ML
│   └── tiktok-shop/{produto}.md     # listings com bom desempenho TikTok
│
├── concorrentes/                    # 🔵 Links e exemplos de concorrentes
│   └── {produto}.md                 # análise por categoria de produto
│
└── keywords/                        # 🟡 Bancos de palavras-chave por categoria
    └── {categoria}.md               # ex: gamer.md, cortador.md
```

## 🟢 Como preencher `listings_que_funcionaram/`

Quando uma listagem sua vender bem (ou tiver alto CTR/impressões), copia ela pro arquivo correspondente.

**Formato sugerido (use [template_listing.md](template_listing.md) como modelo):**

```markdown
# {Nome do produto}

## Marketplace: Shopee
**Período:** 2026-04 a 2026-05
**Métricas:** 47 vendas, 1.2k visitas, CTR 4.5%

### Título usado
Suporte Controle PS5 Dualsense Headset Gamer 3D Mesa Organizador

### Descrição usada
[cole a descrição completa aqui]

### Por que funcionou (sua análise)
- Palavra-chave "suporte controle ps5" no início → ranqueou
- Bullets curtos com benefícios
- Preço competitivo R$ 49,90

### Hashtags/Tags
suporte controle ps5 dualsense gamer organizador setup
```

A skill vai **ler estes arquivos** quando você pedir um listing novo de produto similar, e copiar o **padrão** (ordem de palavras, estrutura de descrição, vocabulário).

## 🔵 Como preencher `concorrentes/`

Quando você ver um concorrente que está vendendo bem em produto similar ao seu:

```markdown
# Cortadores de biscoito - análise de concorrentes

## Concorrente 1
**Link:** https://shopee.com.br/produto-xxx
**Loja:** [Nome da loja]
**Vendas estimadas:** 500+

### Título dele
[título do concorrente]

### O que copiar
- Estrutura "tema + tamanho + material"
- Uso de "festa infantil" no título

### O que evitar
- Foto ruim de fundo escuro
- Descrição muito curta sem benefícios
```

## 🟡 Como preencher `keywords/`

Banco de palavras-chave que você quer **garantir** em listings da categoria. Pode atualizar a qualquer momento.

```markdown
# Categoria: Gamer / PS5

## Keywords prioritárias (sempre incluir se couber)
- suporte controle ps5
- dualsense
- organizador gamer
- setup gamer

## Keywords secundárias (incluir se tiver espaço)
- headset stand
- decoração quarto gamer
- presente gamer

## Keywords de cauda longa (descrição)
- suporte para 2 controles playstation 5
- organizador de mesa para gamer
- apoio para headset gamer

## Sazonalidade
- Black Friday (novembro): aumentar "presente gamer"
- Dia dos Pais (agosto): aumentar "presente para pai gamer"
- Natal: "presente de natal gamer"

## Termos a EVITAR
- "oficial Sony" (marca registrada)
- "PROMOÇÃO" (palavra restrita)
```

## 🚀 Workflow recomendado

1. **Início:** preenche pelo menos 1-2 exemplos seus que deram certo (em [listings_que_funcionaram/](listings_que_funcionaram/))
2. **A cada novo produto:** a skill consulta os exemplos e gera baseado neles
3. **Após 1 mês:** revisar quais listings deram resultado, atualizar os arquivos de treino
4. **Continuamente:** adicionar concorrentes interessantes que aparecerem
5. **A cada trimestre:** atualizar [keywords/](keywords/) com termos sazonais (Páscoa, Dia das Mães, Black Friday, Natal)

## 💡 Dica de ouro

Quanto mais **exemplos seus reais** você botar em `listings_que_funcionaram/`, mais a skill imita **o SEU jeito** de escrever. Sem exemplos, ela só usa as regras gerais dos marketplaces.

A primeira vez que ela rodar pode parecer genérica. Conforme você for adicionando exemplos do que funcionou, ela fica progressivamente mais "Mahou Prints".
