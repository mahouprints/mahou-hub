'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
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

type ProdutoComFilamento = Produto & { filamento: { nome: string } };

export default function ProdutosPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<ProdutoComFilamento[]>('/produtos'),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} itens cadastrados</p>
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
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Canal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.filamento.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(p.pesoG).toFixed(0)}g
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(p.tempoH).toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {centavosParaReais(p.precoCentavos)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.canalPrincipal}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
