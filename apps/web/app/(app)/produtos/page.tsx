'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CalcularOutput, Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, isUrl, pct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
            {data?.length ?? 0} itens · clique numa linha para ver detalhes
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
                <TableHead className="text-right">Peso</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Imposto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Lucro/h</TableHead>
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => {
                const melhor = melhorCanalMarketplace(p);
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => router.push(`/produtos/${p.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      <span className="block truncate max-w-[260px]" title={p.nome}>
                        {p.nome}
                      </span>
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
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <IconeLink url={p.inspiracao} icon={ExternalLink} label="Abrir inspiração" />
                        <IconeLink url={p.modelo3dUrl} icon={Box} label="Abrir modelo 3D" />
                        <BotaoEditar produtoId={p.id} />
                        <BotaoExcluir produtoId={p.id} produtoNome={p.nome} />
                      </div>
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

function BotaoEditar({ produtoId }: { produtoId: string }) {
  return (
    <Link
      href={`/produtos/${produtoId}/editar`}
      title="Editar produto"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Link>
  );
}

function BotaoExcluir({ produtoId, produtoNome }: { produtoId: string; produtoNome: string }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => apiFetch(`/produtos/${produtoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      setAberto(false);
      toast.success(`Produto "${produtoNome}" excluído`);
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Excluir produto"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir produto</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <strong>{produtoNome}</strong>? Esta ação pode ser
            revertida apenas via banco de dados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={excluir.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => excluir.mutate()}
            disabled={excluir.isPending}
          >
            {excluir.isPending ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
