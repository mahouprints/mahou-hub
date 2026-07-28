// Mapa de nichos comerciais × subcategorias do MakerWorld.
//
// Os nichos saem de pesquisa de mercado (2026-07-27), não de intuição:
//  - Etsy global: flexi/articulados em multipack dominam o topo; depois vasos/plantas,
//    organização de parede, joias, miniaturas de tabletop, props de cosplay, acessórios pet.
//  - Brasil (Shopee/ML): suportes e organizadores de setup, toppers de bolo, colecionáveis
//    (Labubu e afins), acessórios personalizados, peças de reposição de eletrodoméstico.
//    Personalização com nome é o multiplicador de margem mais citado.
//
// Categorias deliberadamente FORA: 900 (peças e acessórios de impressora), 903 (modelos de
// calibração), 704 (ferramentas de máquina), 2000 (geradores paramétricos do MakerLab — são
// ferramentas, não modelos prontos). Nada disso vende em marketplace pra consumidor final.
//
// `pesoComercial` (0..1) entra no score final: pondera o quanto o nicho puxa venda no
// Brasil hoje. Não é chute puro — reflete a frequência com que cada categoria aparece
// como top seller nas fontes acima, cruzada com o que a Mahou já vende.

export interface Nicho {
  chave: string;
  nome: string;
  /** IDs de subcategoria do MakerWorld que alimentam esse nicho. */
  categorias: number[];
  pesoComercial: number;
  /** Mostrado ao avaliador (Haiku/Opus) pra ancorar o julgamento visual. */
  descricao: string;
}

export const NICHOS: Nicho[] = [
  {
    chave: 'FLEXI_ARTICULADO',
    nome: 'Flexi / articulados',
    categorias: [801, 805, 601, 603],
    pesoComercial: 1.0,
    descricao:
      'Bichos e criaturas articuladas impressas em peça única (print-in-place), que dobram na mão. Campeão de vendas em marketplace, especialmente em kits com várias unidades. Dragões, cobras, axolotes, polvos, gatos.',
  },
  {
    chave: 'ORGANIZACAO_SETUP',
    nome: 'Organização de mesa e setup',
    categorias: [701, 705, 404],
    pesoComercial: 0.95,
    descricao:
      'Suporte de headset, organizador de cabo, porta-caneta, suporte de controle, bandeja de mesa, suporte de monitor. Demanda alta no Brasil por causa do home office. Peça funcional com uso óbvio.',
  },
  {
    chave: 'DECOR_CASA',
    nome: 'Decoração e vasos',
    categorias: [401, 402],
    pesoComercial: 0.85,
    descricao:
      'Vasos, cachepôs, luminárias, esculturas decorativas, porta-treco bonito. Vende por apelo visual — a foto é o produto. Peça grande demais mata a margem: atenção ao peso.',
  },
  {
    chave: 'FIDGET_ANTISTRESS',
    nome: 'Fidget e anti-stress',
    categorias: [805, 804],
    pesoComercial: 0.85,
    descricao:
      'Cubos, sliders, engrenagens, spinners, quebra-cabeças de manipular. Peça pequena, impressão rápida, margem alta, forte em TikTok. Muito bom pra kit.',
  },
  {
    chave: 'DATAS_FESTIVAS',
    nome: 'Datas comemorativas',
    categorias: [403],
    pesoComercial: 0.8,
    descricao:
      'Natal, Páscoa, Dia das Mães/Pais, Halloween, festa junina. Venda sazonal com pico previsível — exige estoque antecipado. Enfeites de árvore, porta-ovo, lembrancinha, topo de bolo.',
  },
  {
    chave: 'PERSONALIZAVEL',
    nome: 'Personalizáveis (nome/placa)',
    categorias: [102, 103],
    pesoComercial: 0.8,
    descricao:
      'Placas com nome, letreiros, plaquinhas de porta, medalhas, tags. O atalho de margem mais citado no mercado brasileiro: o mesmo tempo de impressão vale 2-3x mais quando leva o nome do cliente.',
  },
  {
    chave: 'PET',
    nome: 'Pet',
    categorias: [405],
    pesoComercial: 0.75,
    descricao:
      'Comedouro, porta-ração, tag de coleira, brinquedo, suporte de pote. Público que gasta e compra por impulso. Tag personalizada com nome do pet é o carro-chefe.',
  },
  {
    chave: 'ACESSORIOS_MODA',
    nome: 'Joias e acessórios',
    categorias: [206, 208, 205, 201],
    pesoComercial: 0.7,
    descricao:
      'Brincos, pingentes, anéis, fivelas. Custo de material quase nulo com valor percebido alto. Exige acabamento bom — modelo com camada aparente não vende aqui.',
  },
  {
    chave: 'GADGET_ELETRONICO',
    nome: 'Suportes de celular e gadgets',
    categorias: [301, 705],
    pesoComercial: 0.7,
    descricao:
      'Suporte de celular, dock de carregador, suporte de tablet, organizador de fone. Peça pequena e funcional, alto giro, baixa diferenciação — só vale com ângulo próprio.',
  },
  {
    chave: 'MINIATURA_TABLETOP',
    nome: 'Miniaturas e tabletop',
    categorias: [604, 602, 802],
    pesoComercial: 0.6,
    descricao:
      'Miniaturas de RPG/D&D, cenários, acessórios de board game (organizadores de caixa, porta-dados). Público nichado que paga bem, mas exige detalhe fino — cuidado com modelo pensado pra resina.',
  },
  {
    chave: 'PROPS_COSPLAY',
    nome: 'Props e cosplay',
    categorias: [1001, 1002, 1003],
    pesoComercial: 0.5,
    descricao:
      'Máscaras, capacetes, réplicas de arma, peças de fantasia. Ticket alto, mas peça grande = muitas horas de impressão e risco de margem. Também é onde mais aparece propriedade intelectual de terceiros.',
  },
  {
    chave: 'BRINQUEDO_INFANTIL',
    nome: 'Brinquedos infantis e educativos',
    categorias: [803, 806, 502, 503],
    pesoComercial: 0.55,
    descricao:
      'Brinquedo de montar, jogo educativo, quebra-cabeça infantil, blocos. Venda para pais e escolas. Atenção a peça pequena solta (risco de engasgo) — evitar em brinquedo pra menor de 3 anos.',
  },
];

/** Todas as subcategorias que o bot varre, sem repetição. */
export function categoriasParaVarrer(): number[] {
  return [...new Set(NICHOS.flatMap((n) => n.categorias))].sort((a, b) => a - b);
}

/** Nichos possíveis pra uma subcategoria — usado pra pré-classificar antes da IA. */
export function nichosDaCategoria(categoriaId: number): Nicho[] {
  return NICHOS.filter((n) => n.categorias.includes(categoriaId));
}

export function nichoPorChave(chave: string): Nicho | undefined {
  return NICHOS.find((n) => n.chave === chave);
}
