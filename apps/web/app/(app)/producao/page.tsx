'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JobDialog } from '@/components/job-dialog';

type JobStatus = 'FILA' | 'IMPRIMINDO' | 'CONCLUIDO' | 'EMBALADO' | 'ENVIADO' | 'CANCELADO';

type Job = {
  id: string;
  status: JobStatus;
  origem: string;
  qtd: number;
  impressora: string;
  observacao: string | null;
  consumoRegistrado: boolean;
  produtoNome: string;
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

export default function ProducaoPage() {
  const qc = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);

  const { data } = useQuery({ queryKey: ['producao'], queryFn: () => apiFetch<Job[]>('/producao') });

  const mudarStatus = useMutation({
    mutationFn: (v: { id: string; status: JobStatus }) =>
      apiFetch(`/producao/${v.id}/status`, { method: 'PATCH', json: { status: v.status } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['producao'] });
      // a baixa de filamento mexe no estoque
      qc.invalidateQueries({ queryKey: ['filamentos'] });
      qc.invalidateQueries({ queryKey: ['estoque', 'alertas'] });
      qc.invalidateQueries({ queryKey: ['estoque', 'movimentos'] });
      toast.success(
        v.status === 'CONCLUIDO'
          ? 'Impresso! Filamento baixado automaticamente ✓'
          : 'Status atualizado',
      );
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => apiFetch(`/producao/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['producao'] });
      toast.success('Job removido');
    },
  });

  function mover(job: Job, dir: 1 | -1) {
    const novo = ORDEM[ORDEM.indexOf(job.status) + dir];
    if (novo) mudarStatus.mutate({ id: job.id, status: novo });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produção</h1>
          <p className="text-sm text-muted-foreground">
            Fila de impressão. Ao mover pra <strong>Impresso</strong>, o filamento baixa sozinho
            (peso da peça × quantidade).
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
                        <span className="font-medium">{job.produtoNome}</span>
                        <span className="shrink-0 text-muted-foreground">x{job.qtd}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.impressora} · {job.filamentoNome} · ~{job.consumoGramas}g
                      </p>
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
                          onClick={() => remover.mutate(job.id)}
                          title="Remover"
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

      <JobDialog open={dialogAberto} onOpenChange={setDialogAberto} />
    </div>
  );
}
