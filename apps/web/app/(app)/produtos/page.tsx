'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Box, ExternalLink, Plus } from 'lucide-react';
import type { CalcularOutput, Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, isUrl, pct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ProdutoComPricing = Produto & {
  filamento: { nome: string };
  pesoG: number;
  tempoH: number;
  pricing: CalcularOutput;
};

interface MelhorCanal {
  canal: 'SHOPEE' | 'ML';
  liquidoCentavos: number;
  margem: number;
  lucroPorHoraCentavos: number;
}

/**
 * Escolhe o canal entre marketplaces (Shopee × ML) com maior líquido por peça.
 * Site fica de fora porque não paga taxa e sempre venceria — não é decisão útil.
 */
function melhorCanalMarketplace(p: ProdutoComPricing): MelhorCanal {
  const shopee: MelhorCanal = {
    canal: 'SHOPEE',
    liquidoCentavos: p.pricing.liquidoShopeeCentavos,
    margem: p.pricing.margemShopee,
    lucroPorHoraCentavos: p.pricing.lucroPorHoraShopeeCentavos,
  };
  const ml: MelhorCanal = {
    canal: 'ML',
    liquidoCentavos: p.pricing.liquidoMlCentavos,
    margem: p.pricing.margemMl,
    lucroPorHoraCentavos: p.pricing.lucroPorHoraMlCentavos,
  };
  return shopee.liquidoCentavos >= ml.liquidoCentavos ? shopee : ml;
}

export default function ProdutosPage() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<ProdutoComPricing[]>('/produtos'),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} itens · clique numa linha para editar
          </p>
        </div>
        <Button asChild>
          <Link href="/produtos/novo">
            <Plus className="h-4 w-4" /> Novo produto
          </Link>
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Filamento</TableHead>
                <TableHead className="text-right">Peso</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Imposto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Lucro/h</TableHead>
                <TableHead className="w-20 text-right">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => {
                const melhor = melhorCanalMarketplace(p);
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => router.push(`/produtos/${p.id}/editar`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      <span className="block truncate max-w-[260px]" title={p.nome}>
                        {p.nome}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.filamento.nome}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.pesoG}g</TableCell>
                    <TableCell className="text-right tabular-nums">{p.tempoH}h</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReais(p.pricing.custoTotalProducaoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {centavosParaReais(p.precoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReais(p.pricing.impostoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centavosParaReais(melhor.liquidoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MargemBadge valor={melhor.margem} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {centavosParaReais(melhor.lucroPorHoraCentavos)}
                    </TableCell>
                    <TableCell>
                      <BotoesLink inspiracao={p.inspiracao} modelo3dUrl={p.modelo3dUrl} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function MargemBadge({ valor }: { valor: number }) {
  const variant = valor >= 0.3 ? 'success' : valor >= 0.15 ? 'warning' : 'danger';
  return (
    <Badge variant={variant} className="font-normal">
      {pct(valor)}
    </Badge>
  );
}

function BotoesLink({
  inspiracao,
  modelo3dUrl,
}: {
  inspiracao: string | null;
  modelo3dUrl: string | null;
}) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <IconeLink url={inspiracao} icon={ExternalLink} label="Abrir inspiração" />
      <IconeLink url={modelo3dUrl} icon={Box} label="Abrir modelo 3D" />
    </div>
  );
}

function IconeLink({
  url,
  icon: Icon,
  label,
}: {
  url: string | null;
  icon: typeof ExternalLink;
  label: string;
}) {
  if (!isUrl(url)) {
    return (
      <span
        title={url ? `Sem URL: "${url}"` : 'Sem link cadastrado'}
        className="inline-flex h-7 w-7 cursor-default items-center justify-center text-muted-foreground/30"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}
