'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Link2, PackageCheck, RefreshCw, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type PedidoStatus = 'PENDENTE' | 'ATENDIDO' | 'BLOQUEADO' | 'CANCELADO' | 'ENVIADO';
type Atendimento = 'SEM_VINCULO' | 'BAIXADO_ESTOQUE' | 'EM_PRODUCAO';

type ItemPedido = {
  id: string;
  skuExterno: string;
  nomeExterno: string;
  qtd: number;
  precoUnitarioCentavos: number;
  atendimento: Atendimento;
  variacao: { sku: string; nome: string; estoqueAtual: number } | null;
};

type Pedido = {
  id: string;
  canal: 'SHOPEE' | 'ML';
  externalId: string;
  statusExterno: string;
  compradorNome: string | null;
  totalCentavos: number;
  prazoEnvio: string | null;
  dataPedido: string;
  status: PedidoStatus;
  observacao: string | null;
  itens: ItemPedido[];
};

type VariacaoOpcao = { id: string; sku: string; nome: string; produtoNome?: string };

const STATUS_VISUAL: Record<PedidoStatus, { rotulo: string; classe: string }> = {
  PENDENTE: { rotulo: 'Pendente', classe: 'bg-muted text-muted-foreground' },
  ATENDIDO: { rotulo: 'Atendido', classe: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  BLOQUEADO: { rotulo: 'Bloqueado', classe: 'bg-destructive/15 text-destructive' },
  ENVIADO: {
    rotulo: 'Enviado',
    classe: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  CANCELADO: { rotulo: 'Cancelado', classe: 'bg-muted text-muted-foreground line-through' },
};

const ATENDIMENTO_VISUAL: Record<Atendimento, string> = {
  SEM_VINCULO: 'SKU sem vínculo',
  BAIXADO_ESTOQUE: 'Baixado do estoque',
  EM_PRODUCAO: 'Na fila de produção',
};

/** Vermelho quando falta menos de 24h — é o prazo que gera penalidade se estourar. */
function prazoVisual(prazo: string | null): { texto: string; classe: string } {
  if (!prazo) return { texto: '—', classe: 'text-muted-foreground' };
  const horas = (new Date(prazo).getTime() - Date.now()) / 3_600_000;
  const data = new Date(prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  if (horas < 0) return { texto: `${data} (vencido)`, classe: 'text-destructive font-medium' };
  if (horas <= 24) return { texto: `${data} (${Math.round(horas)}h)`, classe: 'text-destructive' };
  if (horas <= 48) return { texto: data, classe: 'text-amber-600 dark:text-amber-400' };
  return { texto: data, classe: 'text-muted-foreground' };
}

export default function PedidosPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('todos');

  const params = new URLSearchParams({ limit: '200' });
  if (status !== 'todos') params.set('status', status);

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', params.toString()],
    queryFn: () => apiFetch<{ itens: Pedido[]; total: number }>(`/pedidos?${params}`),
  });

  // Só carrega o catálogo quando há item órfão — a lista de variações não interessa
  // a quem só está conferindo pedidos já atendidos.
  const temOrfao = (data?.itens ?? []).some((p) =>
    p.itens.some((i) => i.atendimento === 'SEM_VINCULO'),
  );
  const { data: variacoes } = useQuery({
    queryKey: ['variacoes-para-vincular'],
    queryFn: () => apiFetch<VariacaoOpcao[]>('/variacoes'),
    enabled: temOrfao,
  });

  const sincronizar = useMutation({
    mutationFn: () => apiFetch('/pedidos/sync?horas=24', { method: 'POST' }),
    onSuccess: (r: unknown) => {
      const res = r as { shopee?: { importados: number }; ml?: { importados: number } };
      const total = (res.shopee?.importados ?? 0) + (res.ml?.importados ?? 0);
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success(total > 0 ? `${total} pedido(s) novo(s)` : 'Nenhum pedido novo');
    },
  });

  const vincular = useMutation({
    mutationFn: ({ itemId, variacaoId }: { itemId: string; variacaoId: string }) =>
      apiFetch(`/pedidos/itens/${itemId}/vincular`, {
        method: 'POST',
        json: { variacaoId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Item vinculado e atendido');
    },
  });

  const pedidos = data?.itens ?? [];
  const bloqueados = pedidos.filter((p) => p.status === 'BLOQUEADO').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos da Shopee e do Mercado Livre. Quem tem peça pronta baixa do estoque; o
            resto entra na fila de produção.
          </p>
        </div>
        <Button onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
          <RefreshCw className={`mr-2 size-4 ${sincronizar.isPending ? 'animate-spin' : ''}`} />
          {sincronizar.isPending ? 'Buscando…' : 'Buscar pedidos'}
        </Button>
      </div>

      {bloqueados > 0 && (
        <Card className="flex items-center gap-3 border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <p className="text-sm">
            <strong>{bloqueados} pedido(s) bloqueado(s)</strong> — o SKU do marketplace não
            existe no catálogo. Vincule abaixo para baixar estoque ou gerar o card de produção.
          </p>
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="BLOQUEADO">Bloqueados</SelectItem>
            <SelectItem value="ATENDIDO">Atendidos</SelectItem>
            <SelectItem value="ENVIADO">Enviados</SelectItem>
            <SelectItem value="CANCELADO">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {data?.total ?? 0} pedidos
        </span>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && pedidos.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum pedido ainda. Clique em <strong>Buscar pedidos</strong> — se nada vier,
          confira se as credenciais da Shopee e do Mercado Livre estão no <code>.env</code>.
        </Card>
      )}

      <div className="space-y-3">
        {pedidos.map((pedido) => {
          const prazo = prazoVisual(pedido.prazoEnvio);
          const visual = STATUS_VISUAL[pedido.status];

          return (
            <Card key={pedido.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                <Badge variant="outline">{pedido.canal}</Badge>
                <span className="font-mono text-sm">{pedido.externalId}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${visual.classe}`}>
                  {visual.rotulo}
                </span>
                <span className="text-xs text-muted-foreground">({pedido.statusExterno})</span>

                <span className={`ml-auto flex items-center gap-1 text-sm ${prazo.classe}`}>
                  <Timer className="size-3.5" />
                  {prazo.texto}
                </span>
                <span className="font-medium">{centavosParaReais(pedido.totalCentavos)}</span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU do marketplace</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido.itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[280px] truncate">{item.nomeExterno}</TableCell>
                      <TableCell className="font-mono text-xs">{item.skuExterno}</TableCell>
                      <TableCell className="text-right">{item.qtd}</TableCell>
                      <TableCell>
                        {item.atendimento === 'SEM_VINCULO' ? (
                          <div className="flex items-center gap-2">
                            <Link2 className="size-3.5 shrink-0 text-destructive" />
                            <Select
                              onValueChange={(variacaoId) =>
                                vincular.mutate({ itemId: item.id, variacaoId })
                              }
                            >
                              <SelectTrigger className="h-8 w-[240px]">
                                <SelectValue placeholder="Vincular a uma variação…" />
                              </SelectTrigger>
                              <SelectContent>
                                {(variacoes ?? []).map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.sku} — {v.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <PackageCheck className="size-3.5" />
                            {ATENDIMENTO_VISUAL[item.atendimento]}
                            {item.variacao && (
                              <span className="text-xs">
                                ({item.variacao.sku} · {item.variacao.estoqueAtual} em estoque)
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
