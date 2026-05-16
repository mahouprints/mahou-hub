/**
 * Catálogo inicial de produtos importado da aba "Produtos" da planilha Farm 3D.
 * `filamentoNome` resolve-se para `filamentoId` no seed via lookup por nome.
 *
 * Unidades:
 *  - pesoG: gramas
 *  - tempoH: horas
 *  - embalagemCentavos / precoCentavos: centavos (R$ * 100)
 */
import type { Canal, Impressora } from '@mahou-hub/contracts';

interface ProdutoSeed {
  nome: string;
  inspiracao: string | null;
  modelo3dUrl: string | null;
  filamentoNome: string;
  pesoG: number;
  tempoH: number;
  impressora: Impressora;
  embalagemCentavos: number;
  precoCentavos: number;
  canalPrincipal: Canal;
}

export const PRODUTOS: ProdutoSeed[] = [
  { nome: 'Organizador de esmalte', inspiracao: 'Mercado Livre', modelo3dUrl: 'Maker World', filamentoNome: 'ABS Branco', pesoG: 417, tempoH: 8, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 4490, canalPrincipal: 'SHOPEE' },
  { nome: 'Chibieren', inspiracao: null, modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 42, tempoH: 2, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2900, canalPrincipal: 'SHOPEE' },
  { nome: 'Onix', inspiracao: 'Mercado Livre', modelo3dUrl: 'Maker World', filamentoNome: 'ABS Branco', pesoG: 95, tempoH: 3, impressora: 'H2C', embalagemCentavos: 200, precoCentavos: 3490, canalPrincipal: 'SHOPEE' },
  { nome: 'Brinco Tanjiro', inspiracao: null, modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 10, tempoH: 1, impressora: 'H2C', embalagemCentavos: 100, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte Para Marcador', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 240, tempoH: 9, impressora: 'A1', embalagemCentavos: 400, precoCentavos: 5990, canalPrincipal: 'SHOPEE' },
  { nome: 'Kit c/3 Suportes de toalha', inspiracao: 'Shopee', modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 21, tempoH: 0.75, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de toalha', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 7, tempoH: 0.25, impressora: 'A1', embalagemCentavos: 100, precoCentavos: 990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de Papel Toalha', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 100, tempoH: 2.5, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2490, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte Carplay', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'ASA Branco', pesoG: 25, tempoH: 1, impressora: 'A1', embalagemCentavos: 500, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Manopla de Cambio', inspiracao: null, modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 60, tempoH: 2, impressora: 'H2C', embalagemCentavos: 200, precoCentavos: 5000, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de Papel Higiênico', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 54, tempoH: 2, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1490, canalPrincipal: 'SHOPEE' },
  { nome: 'Kit c/2 Suportes de Papel Higiênico', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 120, tempoH: 3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de Papel Higiênico c/ bau', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 340, tempoH: 9, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 5990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de Papel Higiênico Polaroid', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 585, tempoH: 18, impressora: 'H2C', embalagemCentavos: 600, precoCentavos: 12990, canalPrincipal: 'ML' },
  { nome: 'Suporte de papel Higiênico Mario', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 554, tempoH: 21, impressora: 'H2C', embalagemCentavos: 600, precoCentavos: 19900, canalPrincipal: 'ML' },
  { nome: 'Chaveiro container', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 16, tempoH: 1.3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2000, canalPrincipal: 'SHOPEE' },
  { nome: 'Organizador de Remédio', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 132, tempoH: 4, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Roda Interativa para gatos', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 129, tempoH: 3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3990, canalPrincipal: 'SHOPEE' },
  { nome: 'Roda Interativa para gatos Wave', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 108, tempoH: 3.4, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3990, canalPrincipal: 'SHOPEE' },
  { nome: 'Roda Interativa para gatos Oval', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 109, tempoH: 3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3490, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de beço', inspiracao: 'Shopee', modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 40, tempoH: 2, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1200, canalPrincipal: 'SHOPEE' },
  { nome: 'Organizador de cabo', inspiracao: 'Shopee', modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 269, tempoH: 5, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3990, canalPrincipal: 'SHOPEE' },
  { nome: 'Contador de livros lidos', inspiracao: 'Etsy', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 90, tempoH: 5.9, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3490, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte para kindle nuvem', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 90, tempoH: 2.5, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte para kindle livro', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 85, tempoH: 2, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Kit 10 suportes pra fotos', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PLA Branco', pesoG: 31, tempoH: 0.4, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Holyland case', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 61, tempoH: 2.5, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3490, canalPrincipal: 'SHOPEE' },
  { nome: 'Cesta decorativa', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 110, tempoH: 6, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 3500, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte Óculos gatinho', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'ABS Branco', pesoG: 120, tempoH: 3.3, impressora: 'H2C', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Placa com o nome  Minecraft', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 80, tempoH: 4, impressora: 'A1', embalagemCentavos: 300, precoCentavos: 3490, canalPrincipal: 'SHOPEE' },
  { nome: 'Placa com o nome', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 22, tempoH: 2, impressora: 'A1', embalagemCentavos: 300, precoCentavos: 3000, canalPrincipal: 'SHOPEE' },
  { nome: 'Estojo de Insulina', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 100, tempoH: 3.7, impressora: 'A1', embalagemCentavos: 300, precoCentavos: 3990, canalPrincipal: 'SHOPEE' },
  { nome: 'Abajur de Ondas', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 82, tempoH: 5.2, impressora: 'A1', embalagemCentavos: 800, precoCentavos: 5990, canalPrincipal: 'SHOPEE' },
  { nome: 'Abajur Nuvem', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 100, tempoH: 6, impressora: 'A1', embalagemCentavos: 800, precoCentavos: 5990, canalPrincipal: 'SHOPEE' },
  { nome: 'Porta Aliança', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 22, tempoH: 1.3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Marca Página Quarta asa', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 16, tempoH: 0.6, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Dragaozinho "Quarta Asa"', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 35, tempoH: 1.8, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Figure Dragão quarta asa', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 70, tempoH: 7, impressora: 'A1', embalagemCentavos: 400, precoCentavos: 4990, canalPrincipal: 'SHOPEE' },
  { nome: 'Love Book', inspiracao: null, modelo3dUrl: 'Thangs', filamentoNome: 'PETG Branco', pesoG: 360, tempoH: 11, impressora: 'A1', embalagemCentavos: 600, precoCentavos: 9900, canalPrincipal: 'ML' },
  { nome: 'Cubo de memoria', inspiracao: null, modelo3dUrl: 'Thangs', filamentoNome: 'PETG Branco', pesoG: 260, tempoH: 6, impressora: 'A1', embalagemCentavos: 600, precoCentavos: 9900, canalPrincipal: 'ML' },
  { nome: 'Cubo de memoria  + 5 pins 10 fotos', inspiracao: null, modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 200, tempoH: 6.5, impressora: 'A1', embalagemCentavos: 2100, precoCentavos: 11990, canalPrincipal: 'ML' },
  { nome: 'Cubo de memoria  + 5 pins 14 fotos', inspiracao: null, modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 250, tempoH: 8.5, impressora: 'A1', embalagemCentavos: 2350, precoCentavos: 14990, canalPrincipal: 'ML' },
  { nome: 'Cubo de memoria  + 5 pins 18 fotos', inspiracao: null, modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 300, tempoH: 10.5, impressora: 'A1', embalagemCentavos: 3450, precoCentavos: 19990, canalPrincipal: 'ML' },
  { nome: 'Suporte Placa de Video', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 16, tempoH: 1.3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Cortador de biscoitos 4 pokemons', inspiracao: null, modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 42, tempoH: 1.45, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Cortador de biscoito copa', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 46, tempoH: 1.5, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 1990, canalPrincipal: 'SHOPEE' },
  { nome: 'Cortador de biscoito Patrulha Canina', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 90, tempoH: 3.3, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte de Controle PS5 + Fone ps5', inspiracao: 'Shopee', modelo3dUrl: null, filamentoNome: 'PETG Branco', pesoG: 250, tempoH: 5, impressora: 'A1', embalagemCentavos: 1000, precoCentavos: 6990, canalPrincipal: 'SHOPEE' },
  { nome: 'Suporte para Móbile de bebê', inspiracao: 'Shopee', modelo3dUrl: 'Maker World', filamentoNome: 'PETG Branco', pesoG: 120, tempoH: 5, impressora: 'A1', embalagemCentavos: 200, precoCentavos: 2990, canalPrincipal: 'SHOPEE' },
];
