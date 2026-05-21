// Categorias Shopee BR curadas como relevantes pra impressão 3D na Mahou.
// IDs validados em 2026-05-21 via `scripts/discover-shopee-categories.ts` (499 produtos
// varridos em top vendas + 9 keywords típicas).
//
// Pra atualizar: rode `pnpm --filter api shopee:discover-categories` mensalmente,
// remova IDs que sumiram e adicione novos que aparecerem com freq >= 10.

export type CategoriaShopee3D = {
  id: number;
  nome: string;
  notas?: string;
};

// Ordem: frequência observada no discover (mais frequentes primeiro).
// Os exemplos nas notas vieram dos próprios produtos encontrados — ajustar conforme
// catálogo Shopee evolui.
export const CATEGORIAS_SHOPEE_3D: CategoriaShopee3D[] = [
  {
    id: 100636,
    nome: 'Decoração festiva / sazonal',
    notas: 'Varais, kits temáticos (Copa, festa), pétalas. Alta cobertura, sazonal.',
  },
  {
    id: 100721,
    nome: 'Organizadores multiuso',
    notas: 'Organizadores de maquiagem giratórios, suportes multiuso de mesa.',
  },
  {
    id: 101256,
    nome: 'Acessórios pra casa (puxadores, ganchos)',
    notas: 'Puxadores acrílicos, ganchos adesivos pra cabo/fio.',
  },
  {
    id: 100279,
    nome: 'Suportes adesivos pra celular/parede',
    notas: 'Suporte multiuso parede, fixador celular sem furar.',
  },
  {
    id: 101262,
    nome: 'Porta-controle TV / suportes parede',
    notas: 'Porta controle Smart TV, suporte multiuso plástico parede.',
  },
  {
    id: 100711,
    nome: 'Geek / colecionáveis (Harry Potter, bonecos)',
    notas: 'Apoiadores de livro temáticos, action figures pequenos.',
  },
  {
    id: 100714,
    nome: 'Decoração retro / miniaturas luminosas',
    notas: 'Estatuetas retrô, mini luminárias decorativas.',
  },
  {
    id: 101254,
    nome: 'Porta-garrafas / caixas organizadoras',
    notas: 'Punho universal pra bebida, caixas-bin pra gaveta.',
  },
  {
    id: 100535,
    nome: 'Porta fone de ouvido',
    notas: 'Suporte de mesa pra fone, base pra headset.',
  },
  {
    id: 100684,
    nome: 'Miniaturas / bonecas',
    notas: 'Mini bonecos, jogos de desafio com peças pequenas.',
  },
  {
    id: 101181,
    nome: 'Vasos decorativos / suculentas',
    notas: 'Vasos pra suculenta, cachepots, latinhas decorativas.',
  },
  {
    id: 101161,
    nome: 'Vasos artesanais / gesso',
    notas: 'Vasos octogonais de gesso, varetas decorativas tulipa.',
  },
  {
    id: 101007,
    nome: 'Miniaturas de bonecas / blocos',
    notas: 'Bonecas de blocos de construção, miniaturas escala pequena.',
  },
  {
    id: 101258,
    nome: 'Kits organizadores escritório',
    notas: 'Porta controle + celular combo, organizador gaveta escritório.',
  },
  {
    id: 100644,
    nome: 'Suporte headset gamer',
    notas: 'Suporte canto de mesa pra headset, fixação adesiva.',
  },
  {
    id: 100584,
    nome: 'Suporte adesivo pra fone',
    notas: 'Porta fone adesivo, suporte auto-adesivo pra fio.',
  },
  {
    id: 101259,
    nome: 'Organizadores de gaveta',
    notas: 'Caixas clear pra gaveta, nichos modulares.',
  },
  // Adicionadas em 2026-05-21 via segunda rodada do discover (varreu 499 produtos).
  {
    id: 100016,
    nome: 'Chaveiros e estojos pequenos',
    notas: 'Chaveiros temáticos (Patrulha, Pokebola), estojos de cartão/controle.',
  },
  {
    id: 100284,
    nome: 'Organizadores de cabo / celular',
    notas: 'Gancho cabo gerenciador de fios, suporte fio adesivo, organizador cabo gancho.',
  },
  {
    id: 100738,
    nome: 'Porta-cartões e credenciais',
    notas: 'Porta-crachá, porta-card BNARDO, porta-cartão de acesso.',
  },
  {
    id: 102601,
    nome: 'Acabamentos plásticos automotivos',
    notas: 'Cinzeiro, porta-treco Peugeot 206, peças plásticas de reposição interior carro.',
  },
];

// Lookup util pra UI/MCP rapidinho.
export const CATEGORIAS_SHOPEE_3D_MAP = new Map(
  CATEGORIAS_SHOPEE_3D.map((c) => [c.id, c]),
);
