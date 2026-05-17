'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Box, ExternalLink, Plus } from 'lucide-react';
import type { CalcularOutput, Canal, Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReaisSemSimbolo, isUrl, pct } from '@/lib/format';
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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Nome</TableHead>
                  <TableHead>Filamento</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Impr.</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Imposto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Lucro/h</TableHead>
                  <TableHead>Canal</TableHead>
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
                      <TableCell className="sticky left-0 bg-card font-medium">
                        <span className="block truncate max-w-[240px]" title={p.nome}>
                          {p.nome}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.filamento.nome}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.pesoG}g</TableCell>
                      <TableCell className="text-right tabular-nums">{p.tempoH}h</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {p.impressora}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {centavosParaReaisSemSimbolo(p.pricing.custoTotalProducaoCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {centavosParaReaisSemSimbolo(p.precoCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {centavosParaReaisSemSimbolo(p.pricing.impostoCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {centavosParaReaisSemSimbolo(melhor.liquidoCentavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <MargemBadge valor={melhor.margem} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {centavosParaReaisSemSimbolo(melhor.lucroPorHoraCentavos)}
                      </TableCell>
                      <TableCell>
                        <CanalBadge canal={melhor.canal} principal={p.canalPrincipal} />
                      </TableCell>
                      <TableCell>
                        <BotoesLink inspiracao={p.inspiracao} modelo3dUrl={p.modelo3dUrl} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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

function CanalBadge({ canal, principal }: { canal: 'SHOPEE' | 'ML'; principal: Canal }) {
  const divergente = canal !== principal && principal !== 'SITE';
  const title = divergente
    ? `Melhor canal seria ${canal}, mas o cadastro está em ${principal}`
    : `Melhor canal: ${canal}`;
  return (
    <span title={title} className="inline-flex items-center gap-1">
      <Badge variant={divergente ? 'warning' : 'outline'} className="text-xs">
        {canal}
      </Badge>
    </span>
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
    <div className="flex items-center justify-end gap-1">
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
      <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/30">
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}
