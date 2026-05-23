'use client';

import { ExternalLink, ShoppingBag, Star } from 'lucide-react';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Schema mínimo do que precisa pra renderizar — funciona tanto pra
 *  ConcorrenteSnapshotProduto quanto pra ProdutoOportunidade. */
export interface ProdutoCardData {
  productName: string;
  imageUrl: string;
  productLink: string;
  priceMinCentavos: number;
  priceMaxCentavos?: number | null;
  /** sales bruto do afiliado (período da campanha) — opcional */
  sales?: number | null;
  /** sales normalizado pra base mensal de 30 dias */
  vendasAfiliadoMes?: number | null;
  /** vendas totais reais (enriquecimento manual via Seller Center) */
  vendasReais?: number | null;
  ratingStar?: number | string | null;
}

interface Props {
  produto: ProdutoCardData;
  /** Conteúdo extra renderizado no rodapé do card (botões de ação, badges custom). */
  footer?: React.ReactNode;
}

export function ProdutoConcorrenteCard({ produto, footer }: Props) {
  const {
    productName,
    imageUrl,
    productLink,
    priceMinCentavos,
    priceMaxCentavos,
    vendasAfiliadoMes,
    vendasReais,
    ratingStar,
  } = produto;

  const rating = ratingStar != null ? Number(ratingStar) : null;
  const faixaPreco =
    priceMaxCentavos != null && priceMaxCentavos !== priceMinCentavos
      ? `${centavosParaReais(priceMinCentavos)} – ${centavosParaReais(priceMaxCentavos)}`
      : centavosParaReais(priceMinCentavos);

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <a
        href={productLink}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={productName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-8 w-8" />
          </div>
        )}
        <span className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md bg-background/90 p-1 text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      </a>

      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">
          {productName}
        </h3>

        <div className="flex items-baseline gap-2">
          <span className="font-semibold tabular-nums">{faixaPreco}</span>
          {rating != null && rating > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {vendasAfiliadoMes != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="font-normal">
                  {vendasAfiliadoMes.toLocaleString('pt-BR')} afiliado/mês
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Vendas via Shopee Affiliate (período de campanha normalizado pra 30 dias). Não é o total real.
              </TooltipContent>
            </Tooltip>
          )}
          {vendasReais != null ? (
            <Badge variant="success" className="font-normal">
              {vendasReais.toLocaleString('pt-BR')} reais/mês
            </Badge>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="font-normal opacity-60">
                  vendas reais: a enriquecer
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Campo livre — pode ser preenchido manualmente via Seller Center quando disponível.
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}
