'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Trash2 } from 'lucide-react';
import type { Recibo, ReciboCreate } from '@mahou-hub/contracts';
import { apiFetch, apiUrl, fetchComRetry } from '@/lib/api-client';
import { parseDecimalParaCentavos } from '@/lib/parsing';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import { UploadDropzone } from '@/components/upload-dropzone';

const MIMES_RECIBO = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/avif',
  'application/pdf',
];

interface Props {
  recibo?: Recibo;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ReciboDialog({ recibo, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const editando = !!recibo;

  const [data, setData] = useState<Date | undefined>(recibo ? new Date(recibo.data) : new Date());
  const [fornecedor, setFornecedor] = useState(recibo?.fornecedor ?? '');
  const [valorReais, setValorReais] = useState(
    recibo?.valorCentavos != null
      ? (recibo.valorCentavos / 100).toFixed(2).replace('.', ',')
      : '',
  );
  const [observacao, setObservacao] = useState(recibo?.observacao ?? '');
  const [arquivosNovos, setArquivosNovos] = useState<File[]>([]);

  async function enviarArquivos(reciboId: string, files: File[]) {
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('arquivos', f));
    const res = await fetchComRetry(apiUrl(`/recibos/${reciboId}/arquivos`), {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.text()) || 'Falha ao enviar os anexos');
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('Informe a data');
      const centavos = valorReais.trim() ? parseDecimalParaCentavos(valorReais) : null;
      const payload: ReciboCreate = {
        data: data.toISOString(),
        fornecedor: fornecedor.trim() || null,
        valorCentavos: centavos != null && Number.isFinite(centavos) ? centavos : null,
        observacao: observacao.trim() || null,
      };
      const r = editando
        ? await apiFetch<Recibo>(`/recibos/${recibo!.id}`, { method: 'PATCH', json: payload })
        : await apiFetch<Recibo>('/recibos', { method: 'POST', json: payload });
      await enviarArquivos(r.id, arquivosNovos);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recibos'] });
      toast.success(editando ? 'Recibo atualizado' : 'Recibo salvo');
      setArquivosNovos([]);
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const removerAnexo = useMutation({
    mutationFn: (arquivoId: string) =>
      apiFetch(`/recibos/${recibo!.id}/arquivos/${arquivoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recibos'] });
      toast.success('Anexo removido');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) {
      toast.error('Informe a data');
      return;
    }
    salvar.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar recibo' : 'Novo recibo'}</DialogTitle>
          <DialogDescription>
            Registre a compra e anexe a nota (imagem ou PDF).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <DatePicker value={data} onChange={setData} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <InputDecimal value={valorReais} onChange={setValorReais} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="forn">Fornecedor</Label>
            <Input
              id="forn"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="ex: VOOLT"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observação</Label>
            <Input
              id="obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="ex: NF-e 140.499"
            />
          </div>

          {recibo && recibo.arquivos.length > 0 && (
            <div className="space-y-1.5">
              <Label>Anexos atuais</Label>
              <ul className="space-y-1">
                {recibo.arquivos.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 truncate text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{a.nomeOriginal}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => removerAnexo.mutate(a.id)}
                      disabled={removerAnexo.isPending}
                      title="Remover anexo"
                      className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{editando ? 'Adicionar anexos' : 'Anexar nota / recibo'}</Label>
            <UploadDropzone
              onArquivos={(fs) => setArquivosNovos((prev) => [...prev, ...fs])}
              disabled={salvar.isPending}
              mimes={MIMES_RECIBO}
              descricao="Imagens ou PDF · máx. 50MB cada"
              label="Arraste, clique ou cole a nota/recibo"
            />
            {arquivosNovos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {arquivosNovos.length} arquivo(s) pra enviar: {arquivosNovos.map((f) => f.name).join(', ')}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={salvar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : editando ? 'Salvar' : 'Salvar recibo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
