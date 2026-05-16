'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Box, Plus } from 'lucide-react';
import type { Produto } from '@mahou-hub/contracts';
import type { CalcularOutput } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReaisSemSimbolo, pct, isUrl } from '@/lib/format';
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
            <Table className="min-w-[1600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Nome</TableHead>
                  <TableHead>Insp.</TableHead>
                  <TableHead>Modelo 3D</TableHead>
                  <TableHead>Filamento</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Impr.</TableHead>
                  <TableHead className="text-right">C. fil.</TableHead>
                  <TableHead className="text-right">Embal.</TableHead>
                  <TableHead className="text-right">C. en.</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Imposto</TableHead>
                  <TableHead className="text-right">Liq. ML</TableHead>
                  <TableHead className="text-right">Liq. Shopee</TableHead>
                  <TableHead className="text-right">Marg. ML</TableHead>
                  <TableHead className="text-right">Marg. Sh.</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Lucro/h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow
                    key={p.id}
                    onClick={() => router.push(`/produtos/${p.id}/editar`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="sticky left-0 bg-card font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]" title={p.nome}>{p.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <LinkOuTexto valor={p.inspiracao} icone="link" />
                    </TableCell>
                    <TableCell>
                      <LinkOuTexto valor={p.modelo3dUrl} icone="box" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.filamento.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.pesoG}g</TableCell>
                    <TableCell className="text-right tabular-nums">{p.tempoH}h</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{p.impressora}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReaisSemSimbolo(p.pricing.custoFilamentoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReaisSemSimbolo(p.embalagemCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReaisSemSimbolo(p.pricing.custoEnergiaCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {centavosParaReaisSemSimbolo(p.precoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReaisSemSimbolo(p.pricing.impostoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centavosParaReaisSemSimbolo(p.pricing.liquidoMlCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centavosParaReaisSemSimbolo(p.pricing.liquidoShopeeCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MargemBadge valor={p.pricing.margemMl} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MargemBadge valor={p.pricing.margemShopee} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{p.canalPrincipal}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centavosParaReaisSemSimbolo(
                        p.canalPrincipal === 'SHOPEE'
                          ? p.pricing.lucroPorHoraShopeeCentavos
                          : p.pricing.lucroPorHoraMlCentavos,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
  return <Badge variant={variant} className="font-normal">{pct(valor)}</Badge>;
}

function LinkOuTexto({ valor, icone }: { valor: string | null; icone: 'link' | 'box' }) {
  if (!valor) return <span className="text-muted-foreground/50 text-xs">—</span>;
  if (!isUrl(valor)) {
    return (
      <span className="text-xs text-muted-foreground" title={valor}>
        {valor}
      </span>
    );
  }
  const Icon = icone === 'link' ? ExternalLink : Box;
  return (
    <a
      href={valor}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <Icon className="h-3 w-3" />
      Abrir
    </a>
  );
}
