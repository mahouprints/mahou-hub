# Scoring de oportunidades (0-100)

Como pontuar candidatos pra ranquear no backlog.

## Componentes

### Vendas estimadas/mês (0-40 pts)

| `vendasEstimadasMes` | Pontos |
|---|---|
| >= 5000 | 40 |
| 2000–4999 | 32 |
| 1000–1999 | 24 |
| 500–999 | 16 |
| 200–499 | 8 |
| < 200 | 0 |

Escala log porque cada dobra de venda representa salto qualitativo de demanda.

### Faixa de preço (0-20 pts)

Sweet spot pra impressão 3D: tempo de impressão + filamento + frete cabem em R$ 30-120 com margem >30%.

| `priceMinCentavos` (R$) | Pontos |
|---|---|
| 3000–12000 (R$30-120) | 20 |
| 2000–3000 ou 12000–18000 | 12 |
| 1500–2000 ou 18000–25000 | 6 |
| < R$15 ou > R$250 | 0 |

### Replicabilidade em 3D (0-30 pts)

Qualitativo. Avalie nome + imagem:

| Caso | Pontos |
|---|---|
| Decoração simples (porta-x, suporte, miniatura sem detalhe extremo) | 30 |
| Decoração média (figura com detalhes, vaso com textura) | 22 |
| Decoração complexa (action figure articulada, multi-cor) | 14 |
| Funcional simples (gancho, organizador) | 25 |
| Funcional com mecanismo (peça que encaixa em algo específico) | 18 |
| Categoria limítrofe (pet, infantil, transparente) | 8 |
| Categoria não-encaixa (ver [criterios-3d.md](criterios-3d.md)) | 0 |

### Rating (0-10 pts)

| `ratingStar` | Pontos |
|---|---|
| >= 4.8 | 10 |
| 4.5–4.7 | 7 |
| 4.0–4.4 | 4 |
| < 4.0 ou null | 0 |

### Penalidade: risco legal (-20 pts)

Aplicar se nome/imagem indicar IP licenciado (Disney, Marvel, Pokémon, Nike, escudos de time, etc.).

## Fórmula

```
score = vendas_pts + preco_pts + replicabilidade_pts + rating_pts - risco_legal_pts
```

Clamp em [0, 100].

## Como reportar nas `notas`

Estrutura padrão pra `notas` (Claude preenche ao salvar):

```
**Demanda:** ~XYZ vendas/mês (40 pts) — categoria saturada/insaturada
**Preço:** R$ XX-YY (XX pts) — sweet spot / acima / abaixo
**Replicabilidade:** [descrição curta] (XX pts)
**Rating:** X.X (X pts)
**Risco:** nenhum / IP da [marca] / categoria sensível
**Sugestão:** [variação ou ângulo único que a Mahou pode trazer]
```

Exemplo:
```
**Demanda:** ~3200 vendas/mês (32 pts) — porta-controle ainda em crescimento
**Preço:** R$ 35-49 (20 pts) — sweet spot
**Replicabilidade:** geometria simples, parede 2mm, encaixa todos PS5/Xbox (28 pts)
**Rating:** 4.7 (7 pts)
**Risco:** nenhum
**Sugestão:** versão com encaixe pra fone gamer integrado — pouco concorrente faz
Score: 87
```
