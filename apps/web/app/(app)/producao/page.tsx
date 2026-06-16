'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { JobDialog } from '@/components/job-dialog';
import { HistoricoProducao } from '@/components/historico-producao';

type JobStatus = 'FILA' | 'IMPRIMINDO' | 'CONCLUIDO' | 'EMBALADO' | 'ENVIADO' | 'CANCELADO';

type Job = {
  id: string;
  status: JobStatus;
  origem: string;
  qtd: number;
  impressora: string;
  observacao: string | null;
  consumoRegistrado: boolean;
  consumoProdutoRegistrado: boolean;
  daEstoque: boolean;
  produtoNome: string;
  variacaoNome: string | null;
  filamentoNome: string;
  consumoGramas: number;
};

const COLUNAS: [JobStatus, string][] = [
  ['FILA', 'Fila'],
  ['IMPRIMINDO', 'Imprimindo'],
  ['CONCLUIDO', 'Impresso'],
  ['EMBALADO', 'Embalado'],
  ['ENVIADO', 'Enviado'],
];
const ORDEM: JobStatus[] = ['FILA', 'IMPRIMINDO', 'CONCLUIDO', 'EMBALADO', 'ENVIADO'];

// Mover pra cá baixa o estoque de prontos (cards do estoque) — invalida tudo que muda.
const INVALIDAR_ESTOQUE: unknown[][] = [
  ['producao'],
  ['filamentos'],
  ['variacoes'],
  ['estoque', 'alertas'],
  ['estoque', 'movimentos'],
];

export default function ProducaoPage() {
  const qc = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [jobParaExcluir, setJobParaExcluir] = useState<Job | null>(null);

  const { data } = useQuery({ queryKey: ['producao'], queryFn: () => apiFetch<Job[]>('/producao') });

  function invalidarEstoque() {
    for (const key of INVALIDAR_ESTOQUE) qc.invalidateQueries({ queryKey: key });
  }

  const mudarStatus = useMutation({
    mutationFn: (v: { id: string; status: JobStatus }) =>
      apiFetch(`/producao/${v.id}/status`, { method: 'PATCH', json: { status: v.status } }),
    onSuccess: (_d, v) => {
      invalidarEstoque();
      toast.success(
        v.status === 'CONCLUIDO'
          ? 'Impresso! Filamento baixado automaticamente ✓'
          : v.status === 'EMBALADO'
            ? 'Embalado ✓'
            : 'Status atualizado',
      );
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; estornado: boolean; gramas: number; prontosEstornados: number }>(
        `/producao/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: (res) => {
      invalidarEstoque();
      const partes: string[] = [];
      if (res.gramas > 0) partes.push(`${res.gramas}g de filamento`);
      if (res.prontosEstornados > 0)
        partes.push(`${res.prontosEstornados} ${res.prontosEstornados === 1 ? 'peça' : 'peças'}`);
      toast.success(partes.length ? `Job removido — devolvido: ${partes.join(' + ')}` : 'Job removido');
      setJobParaExcluir(null);
    },
  });

  function mover(job: Job, dir: 1 | -1) {
    const novo = ORDEM[ORDEM.indexOf(job.status) + dir];
    if (novo) mudarStatus.mutate({ id: job.id, status: novo });
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produção</h1>
          <p className="text-sm text-muted-foreground">
            Ao mover pra <strong>Impresso</strong>, o filamento baixa sozinho. Cards{' '}
            <strong>do estoque</strong> pulam a impressão e baixam o estoque de peças prontas ao{' '}
            <strong>Embalar</strong>.
          </p>
        </div>
        <Button onClick={() => setDialogAberto(true)}>
          <Plus className="h-4 w-4" /> Novo job
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUNAS.map(([status, label]) => {
          const jobs = data?.filter((j) => j.status === status) ?? [];
          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
                <Badge variant="default">{jobs.length}</Badge>
              </div>
              <div className="space-y-2">
                {jobs.map((job) => {
                  const i = ORDEM.indexOf(job.status);
                  return (
                    <div key={job.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">
                          {job.produtoNome}
                          {job.variacaoNome && (
                            <span className="text-muted-foreground"> · {job.variacaoNome}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-muted-foreground">x{job.qtd}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.impressora} · {job.filamentoNome}
                        {!job.daEstoque && ` · ~${job.consumoGramas}g`}
                      </p>
                      {job.daEstoque && (
                        <Badge
                          variant="default"
                          className="mt-1.5 bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        >
                          do estoque
                        </Badge>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => mover(job, -1)}
                            disabled={i <= 0 || mudarStatus.isPending}
                            title="Voltar"
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          {job.status === 'IMPRIMINDO' ? (
                            <button
                              type="button"
                              onClick={() => mudarStatus.mutate({ id: job.id, status: 'CONCLUIDO' })}
                              disabled={mudarStatus.isPending}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600/15 px-2 py-1 text-xs font-medium text-emerald-600"
                            >
                              <Check className="h-3 w-3" /> Impresso
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => mover(job, 1)}
                              disabled={i >= ORDEM.length - 1 || mudarStatus.isPending}
                              title="Avançar"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setJobParaExcluir(job)}
                          title="Excluir"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {jobs.length === 0 && (
                  <p className="px-1 text-xs text-muted-foreground/50">vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <HistoricoProducao />

      <JobDialog open={dialogAberto} onOpenChange={setDialogAberto} />

      <Dialog
        open={!!jobParaExcluir}
        onOpenChange={(v) => {
          if (!v) setJobParaExcluir(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir job de produção?</DialogTitle>
            <DialogDescription>
              {jobParaExcluir && (
                <>
                  Excluir <strong>{jobParaExcluir.produtoNome}</strong>
                  {jobParaExcluir.variacaoNome ? ` (${jobParaExcluir.variacaoNome})` : ''} x
                  {jobParaExcluir.qtd}.{' '}
                  {jobParaExcluir.consumoProdutoRegistrado
                    ? `Como já foi embalado, as ${jobParaExcluir.qtd} peças voltam ao estoque de prontos.`
                    : jobParaExcluir.consumoRegistrado
                      ? `Como já foi impresso, os ~${jobParaExcluir.consumoGramas}g de ${jobParaExcluir.filamentoNome} voltam pro estoque.`
                      : 'Essa ação não pode ser desfeita.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setJobParaExcluir(null)}
              disabled={remover.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => jobParaExcluir && remover.mutate(jobParaExcluir.id)}
              disabled={remover.isPending}
            >
              {remover.isPending ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
