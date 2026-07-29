'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import type { Recibo } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ReciboDialog } from '@/components/recibo-dialog';
import { RevisaoNotaDialog } from '@/components/revisao-nota-dialog';

/** O que o status do recibo mostra na lista. PENDENTE não vira badge — é o estado normal. */
const BADGE_STATUS: Record<string, { texto: string; variante: 'default' | 'outline' }> = {
  EXTRAIDO: { texto: 'lido, aguardando revisão', variante: 'outline' },
  CONFIRMADO: { texto: 'lançado no estoque', variante: 'default' },
};

export default function RecibosPage() {
  const qc = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Recibo | undefined>();
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recibos'],
    queryFn: () => apiFetch<Recibo[]>('/recibos'),
  });

  const remover = useMutation({
    mutationFn: (id: string) => apiFetch(`/recibos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recibos'] });
      setConfirmarId(null);
      toast.success('Recibo removido');
    },
  });

  function novo() {
    setEmEdicao(undefined);
    setDialogAberto(true);
  }
  function editar(r: Recibo) {
    setEmEdicao(r);
    setDialogAberto(true);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recibos</h1>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} compras registradas · com a nota (imagem ou PDF) anexada
          </p>
        </div>
        <Button onClick={novo}>
          <Plus className="h-4 w-4" /> Novo recibo
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum recibo ainda. Clique em &quot;Novo recibo&quot; pra registrar uma compra.
        </p>
      )}

      <div className="space-y-3">
        {data?.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.fornecedor ?? 'Compra'}</span>
                  {r.valorCentavos != null && (
                    <Badge variant="default">{centavosParaReais(r.valorCentavos)}</Badge>
                  )}
                  {BADGE_STATUS[r.status] && (
                    <Badge variant={BADGE_STATUS[r.status]!.variante}>
                      {BADGE_STATUS[r.status]!.texto}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.data).toLocaleDateString('pt-BR')}
                  {r.observacao ? ` · ${r.observacao}` : ''}
                  {r.itens.length > 0 ? ` · ${r.itens.length} item(ns)` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRevisandoId(r.id)}
                  title={r.status === 'PENDENTE' ? 'Ler nota com IA' : 'Revisar nota'}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editar(r)}
                  title="Editar"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {confirmarId === r.id ? (
                  <button
                    type="button"
                    onClick={() => remover.mutate(r.id)}
                    disabled={remover.isPending}
                    className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground"
                  >
                    Confirmar?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmarId(r.id)}
                    title="Remover"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {r.arquivos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.arquivos.map((a) =>
                  a.mimeType.startsWith('image/') ? (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-md border border-border"
                      title={a.nomeOriginal}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={a.nomeOriginal}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-accent"
                      title={a.nomeOriginal}
                    >
                      <FileText className="h-4 w-4" /> PDF
                    </a>
                  ),
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <ReciboDialog recibo={emEdicao} open={dialogAberto} onOpenChange={setDialogAberto} />

      {revisandoId && (
        <RevisaoNotaDialog
          reciboId={revisandoId}
          open={!!revisandoId}
          onOpenChange={(v) => !v && setRevisandoId(null)}
        />
      )}
    </div>
  );
}
