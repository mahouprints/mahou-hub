# Como treinar a skill `/gerar-post`

Esta pasta alimenta a skill com referências do que funciona — você selecionou treinar com **concorrentes/marcas referência**.

---

## 📂 Estrutura

```
~/Instagram/treino/
├── posts_que_funcionaram/    # 🟢 quando você tiver posts seus que viralizam
├── concorrentes/             # 🔵 marcas que você quer imitar o estilo
└── hashtags/                 # 🟡 banco de hashtags por nicho
```

## 🔵 Como preencher `concorrentes/`

Você escolheu treinar com **concorrentes/marcas referência**. Pra cada marca-referência, cria um arquivo `{marca}.md` em [concorrentes/](concorrentes/) usando o [template_concorrente.md](concorrentes/_template_concorrente.md).

### O que coletar de cada marca-referência
- @ do perfil
- O que ela faz bem (tom, formato, frequência)
- 3-5 posts específicos que você gostaria de imitar (link + captura visual + copy)
- Estilo de hashtag dela
- Frequência de posts
- Tipos de post que ela mais usa

### Sugestões de categorias de marcas-referência pra Mahou Prints

| Categoria | Onde buscar | O que olhar |
|---|---|---|
| **Marcas 3D/maker brasileiras** | @print3dbrasil, @creality3d_br, lojas Etsy 3D | Como mostrar processo e BTS |
| **Marcas de decoração autoral** | @atelier_*** instagrams pequenos | Tom emocional, fotografia warm |
| **Marcas premium pequenas** | Lojas Etsy curadas, marcas indie brasileiras | Como vender sem ser comercial |
| **Marcas com storytelling forte** | Brands tipo @sezane (referência internacional) | Como contar história em copy |
| **Concorrentes diretos** | Lojas que vendem produtos similares | Que NÃO fazer (geralmente vendem mal pelo IG) |

## 🟢 Como preencher `posts_que_funcionaram/`

Conforme você começar a postar e tiver posts seus que viralizaram (alto save, share, comment), copia ele pra essa pasta usando o template. A skill vai começar a IMITAR seu estilo de sucesso.

## 🟡 Como preencher `hashtags/`

Cria 1 arquivo por nicho/categoria (ex: `gamer.md`, `decoracao.md`, `leitura.md`, `cozinha.md`). Em cada arquivo, lista:
- 30 hashtags estratificadas (alto/médio/nicho volume)
- Tags pra evitar (banidas ou shadow-banned)
- Hashtags sazonais por mês

A skill consulta esse banco antes de gerar hashtag pra post.

## 🚀 Workflow recomendado

1. **Agora:** preencher 2-3 concorrentes-referência (não precisa todos)
2. **Próximas semanas:** ir copiando posts que funcionarem em [posts_que_funcionaram/](posts_que_funcionaram/)
3. **A cada nicho que postar:** atualizar [hashtags/](hashtags/) com o que performou
4. **Roda comando `/gerar-post aprender`** periodicamente — extrai padrão do que você adicionou

## 💡 Dica de ouro

A skill começa com referências de marca-modelo (concorrentes que você admira). Conforme você posta, ela vai pivotando pro SEU estilo. **Equilíbrio: 70% baseado no que VOCÊ aprova, 30% no que as referências fazem.**
