'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, ScanLine } from 'lucide-react';
import type { Filamento, Insumo, Recibo } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RevisaoItemLinha } from '@/components/revisao-item-linha';

/** Nome técnico do campo → como o Gabriel chama a coisa. */
const NOME_AMIGAVEL: Record<string, string> = {
  fornecedor: 'fornecedor',
  data: 'data da compra',
  valorTotal: 'valor total',
};

interface Props {
  reciboId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function RevisaoNotaDialog({ reciboId, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const { data: recibo } = useQuery({
    queryKey: ['recibo', reciboId],
    queryFn: () => apiFetch<Recibo>(`/recibos/${reciboId}`),
    enabled: open,
  });
  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
    enabled: open,
  });
  const { data: insumos } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => apiFetch<Insumo[]>('/insumos'),
    enabled: open,
  });

  function recarregar() {
    qc.invalidateQueries({ queryKey: ['recibo', reciboId] });
    qc.invalidateQueries({ queryKey: ['recibos'] });
  }

  const extrair = useMutation({
    mutationFn: () => apiFetch<Recibo>(`/recibos/${reciboId}/extrair`, { method: 'POST' }),
    onSuccess: (r) => {
      recarregar();
      const buracos = r.camposIlegiveis.length + r.itens.filter((i) => i.camposIlegiveis.length).length;
      if (buracos > 0) {
        toast.warning(`Li a nota, mas ${buracos} campo(s) ficaram ilegíveis — confira abaixo`);
        return;
      }
      toast.success(`Li a nota: ${r.itens.length} item(ns) encontrados`);
    },
  });

  const confirmar = useMutation({
    mutationFn: () => apiFetch<Recibo>(`/recibos/${reciboId}/confirmar`, { method: 'POST' }),
    onSuccess: () => {
      recarregar();
      qc.invalidateQueries({ queryKey: ['estoque'] });
      qc.invalidateQueries({ queryKey: ['custos'] });
      toast.success('Compra aplicada: estoque atualizado');
      onOpenChange(false);
    },
  });

  const confirmado = recibo?.status === 'CONFIRMADO';
  const semLeitura = recibo?.status === 'PENDENTE';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar nota</DialogTitle>
          <DialogDescription>
            {semLeitura
              ? 'A IA lê a nota anexada e propõe os itens. Nada entra no estoque sem você confirmar.'
              : 'Confira o que foi lido. Corrija o que estiver errado antes de confirmar.'}
          </DialogDescription>
        </DialogHeader>

        {!recibo && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {recibo && semLeitura && (
          <div className="space-y-3 py-2">
            {recibo.arquivos.length === 0 && (
              <p className="text-sm text-destructive">
                Este recibo não tem nota anexada. Anexe a foto ou o PDF antes de ler.
              </p>
            )}
            <Button
              onClick={() => extrair.mutate()}
              disabled={extrair.isPending || recibo.arquivos.length === 0}
            >
              <ScanLine className="h-4 w-4" />
              {extrair.isPending ? 'Lendo a nota…' : 'Ler nota com IA'}
            </Button>
          </div>
        )}

        {recibo && !semLeitura && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-sm">
              <Campo rotulo="Fornecedor" valor={recibo.fornecedor ?? '—'} />
              <Campo rotulo="Data" valor={new Date(recibo.data).toLocaleDateString('pt-BR')} />
              <Campo
                rotulo="Valor total"
                valor={recibo.valorCentavos != null ? centavosParaReais(recibo.valorCentavos) : '—'}
              />
            </div>

            {recibo.camposIlegiveis.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium">A IA não conseguiu ler tudo</p>
                  <p className="text-muted-foreground">
                    Ficou ilegível:{' '}
                    {recibo.camposIlegiveis.map((c) => NOME_AMIGAVEL[c] ?? c).join(', ')}. Tire outra
                    foto com mais luz e leia de novo, ou preencha na mão no botão de editar.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => extrair.mutate()}
                    disabled={extrair.isPending || confirmado}
                  >
                    {extrair.isPending ? 'Lendo…' : 'Ler de novo'}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {recibo.itens.length} item(ns) na nota
                <span className="ml-2 font-normal text-muted-foreground">
                  filamento e insumo entram no estoque · o resto vira custo
                </span>
              </p>
              {recibo.itens.map((item) => (
                <RevisaoItemLinha
                  key={item.id}
                  reciboId={reciboId}
                  item={item}
                  filamentos={filamentos ?? []}
                  insumos={insumos ?? []}
                  bloqueado={confirmado}
                  onMudou={recarregar}
                />
              ))}
              {recibo.itens.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum item foi lido. Se a nota tem itens, tire outra foto e leia de novo.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {recibo && !semLeitura && !confirmado && (
            <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
              <Check className="h-4 w-4" />
              {confirmar.isPending ? 'Aplicando…' : 'Confirmar e lançar'}
            </Button>
          )}
          {confirmado && (
            <span className="self-center text-sm text-muted-foreground">
              Já lançado no estoque em{' '}
              {recibo?.confirmadoEm ? new Date(recibo.confirmadoEm).toLocaleDateString('pt-BR') : ''}
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
