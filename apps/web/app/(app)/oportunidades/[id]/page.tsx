'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Save, Sparkles, Trash, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Status = 'NOVO' | 'EM_ANALISE' | 'APROVADO' | 'DESCARTADO' | 'VIRARAM_PRODUTO';

type Oportunidade = {
  id: string;
  marketplace: 'SHOPEE' | 'TIKTOK' | 'ML' | 'OUTRO';
  externalId: string;
  productName: string;
  priceMinCentavos: number;
  priceMaxCentavos: number;
  imageUrl: string;
  productLink: string;
  vendasEstimadasMes: number;
  ratingStar: string | null;
  categoriaIds: number[];
  lojaExternalId: string | null;
  lojaNome: string | null;
  fonte: 'CONCORRENTE' | 'KEYWORD' | 'CATEGORIA' | 'TOP_VENDAS';
  fonteParam: string | null;
  status: Status;
  score: string | null;
  notas: string | null;
  produtoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

type Filamento = { id: string; nome: string; ativo: boolean };

type HistoricoEntry = {
  id: string;
  acao: 'CREATED' | 'STATUS_CHANGE' | 'SCORE_CHANGE' | 'NOTAS_CHANGE' | 'VIRARAM_PRODUTO';
  detalhes: Record<string, unknown>;
  usuarioId: string | null;
  criadoEm: string;
};

const STATUS_LABEL: Record<Status, string> = {
  NOVO: 'Novo',
  EM_ANALISE: 'Em análise',
  APROVADO: 'Aprovado',
  DESCARTADO: 'Descartado',
  VIRARAM_PRODUTO: 'Virou produto',
};

export default function OportunidadeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const qc = useQueryClient();
  const router = useRouter();

  const { data: o, isLoading } = useQuery({
    queryKey: ['oportunidade', id],
    queryFn: () => apiFetch<Oportunidade>(`/oportunidades/${id}`),
  });

  const [status, setStatus] = useState<Status | null>(null);
  const [score, setScore] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [virarOpen, setVirarOpen] = useState(false);

  // Inicializa do server quando carregar.
  if (o && status === null) {
    setStatus(o.status);
    setScore(o.score ?? '');
    setNotas(o.notas ?? '');
  }

  const salvar = useMutation({
    mutationFn: () =>
      apiFetch(`/oportunidades/${id}`, {
        method: 'PATCH',
        json: {
          status: status ?? undefined,
          score: score.trim() === '' ? null : Number(score),
          notas: notas.trim() === '' ? null : notas,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oportunidade', id] });
      qc.invalidateQueries({ queryKey: ['oportunidades'] });
      toast.success('Atualizado');
    },
  });

  const descartar = useMutation({
    mutationFn: () => apiFetch(`/oportunidades/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oportunidades'] });
      toast.success('Oportunidade removida');
      router.push('/oportunidades');
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!o) return <div className="p-6 text-destructive">Oportunidade não encontrada</div>;

  const precoStr =
    o.priceMinCentavos === o.priceMaxCentavos
      ? centavosParaReais(o.priceMinCentavos)
      : `${centavosParaReais(o.priceMinCentavos)} – ${centavosParaReais(o.priceMaxCentavos)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/oportunidades">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={o.imageUrl}
              alt=""
              className="h-24 w-24 rounded-lg border object-cover"
            />
            <div className="flex-1">
              <CardTitle className="text-xl">{o.productName}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline">{o.marketplace}</Badge>
                <Badge variant="outline">Fonte: {o.fonte}</Badge>
                {o.fonteParam && <span>&ldquo;{o.fonteParam}&rdquo;</span>}
                {o.lojaNome && <span>{o.lojaNome}</span>}
                <a
                  href={o.productLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {o.produtoId ? (
                <Button variant="outline" asChild>
                  <Link href={`/produtos/${o.produtoId}`}>
                    <Sparkles className="mr-2 h-4 w-4" /> Ver produto
                  </Link>
                </Button>
              ) : (
                <Button onClick={() => setVirarOpen(true)}>
                  <Wand2 className="mr-2 h-4 w-4" /> Virar produto
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Remover esta oportunidade do backlog?')) descartar.mutate();
                }}
                disabled={descartar.isPending}
              >
                <Trash className="mr-2 h-4 w-4" /> Descartar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Preço</dt>
              <dd className="font-medium tabular-nums">{precoStr}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vendas est./mês</dt>
              <dd className="font-medium tabular-nums">
                {o.vendasEstimadasMes.toLocaleString('pt-BR')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="font-medium">
                {o.ratingStar ? Number(o.ratingStar).toFixed(1) : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status ?? o.status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Score (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              rows={8}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Análise de demanda, replicabilidade, riscos, ideias de variação…"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {salvar.isPending ? 'Salvando…' : 'Salvar análise'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <HistoricoCard id={id} />

      <VirarProdutoDialog
        open={virarOpen}
        onOpenChange={setVirarOpen}
        oportunidade={o}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['oportunidade', id] });
          qc.invalidateQueries({ queryKey: ['oportunidades'] });
        }}
      />
    </div>
  );
}

function HistoricoCard({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['oportunidade', id, 'historico'],
    queryFn: () => apiFetch<HistoricoEntry[]>(`/oportunidades/${id}/historico`),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
        )}
        <ul className="space-y-2">
          {data?.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(e.criadoEm).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="flex-1">
                <strong className="font-medium">{descreverAcao(e)}</strong>
                {e.usuarioId === null && (
                  <span className="ml-2 text-xs text-muted-foreground">(sistema)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function descreverAcao(e: HistoricoEntry): string {
  const d = e.detalhes;
  switch (e.acao) {
    case 'CREATED':
      return `Criada (fonte: ${String(d.fonte)}, status: ${String(d.status)})`;
    case 'STATUS_CHANGE':
      return `Status: ${String(d.de)} → ${String(d.para)}`;
    case 'SCORE_CHANGE':
      return `Score: ${d.de ?? '—'} → ${d.para ?? '—'}`;
    case 'NOTAS_CHANGE':
      return `Notas editadas (${d.tamanhoDe ?? 0} → ${d.tamanhoPara ?? 0} chars)`;
    case 'VIRARAM_PRODUTO':
      return `Virou produto ${String(d.produtoId)}`;
    default:
      return e.acao;
  }
}

function VirarProdutoDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade: Oportunidade;
  onCreated: () => void;
}) {
  const { open, onOpenChange, oportunidade, onCreated } = props;
  const router = useRouter();

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const precoSugerido = Math.round(
    (oportunidade.priceMinCentavos + oportunidade.priceMaxCentavos) / 2,
  );

  const [filamentoId, setFilamentoId] = useState('');
  const [pesoG, setPesoG] = useState('');
  const [tempoH, setTempoH] = useState('');
  const [impressora, setImpressora] = useState<'A1' | 'H2C'>('A1');
  const [embalagemReais, setEmbalagemReais] = useState('0');
  const [precoReais, setPrecoReais] = useState((precoSugerido / 100).toFixed(2));

  const ativos = filamentos?.filter((f) => f.ativo) ?? [];

  // Completo precisa de filamento + peso>0 + tempo>0. Senão, vira rascunho.
  const completo =
    filamentoId !== '' && Number(pesoG) > 0 && Number(tempoH) > 0;

  const virar = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/oportunidades/${oportunidade.id}/virar-produto`, {
        method: 'POST',
        json: {
          ...(filamentoId ? { filamentoId } : {}),
          ...(Number(pesoG) > 0 ? { pesoG: Number(pesoG) } : {}),
          ...(Number(tempoH) > 0 ? { tempoH: Number(tempoH) } : {}),
          ...(completo ? { impressora } : {}),
          embalagemCentavos: Math.round(Number(embalagemReais) * 100),
          precoCentavos: Math.round(Number(precoReais) * 100),
        },
      }),
    onSuccess: (produto) => {
      toast.success(completo ? 'Produto criado' : 'Rascunho criado — complete pra anunciar');
      onOpenChange(false);
      onCreated();
      router.push(`/produtos/${produto.id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{completo ? 'Virar produto' : 'Criar rascunho'}</DialogTitle>
          <DialogDescription>
            Preencha filamento + peso + tempo pra criar produto completo. Se algum faltar, vira
            um <strong>rascunho</strong> (ativo=false) que você completa depois na página do produto.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            virar.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Filamento</Label>
            <Select value={filamentoId} onValueChange={setFilamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (vazio = rascunho)" />
              </SelectTrigger>
              <SelectContent>
                {ativos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Peso (g)</Label>
              <Input
                type="number"
                step={0.1}
                min={0}
                value={pesoG}
                onChange={(e) => setPesoG(e.target.value)}
                placeholder="0 = rascunho"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tempo (h)</Label>
              <Input
                type="number"
                step={0.1}
                min={0}
                value={tempoH}
                onChange={(e) => setTempoH(e.target.value)}
                placeholder="0 = rascunho"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Impressora</Label>
              <Select value={impressora} onValueChange={(v) => setImpressora(v as 'A1' | 'H2C')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="H2C">H2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                step={0.01}
                min={0}
                value={precoReais}
                onChange={(e) => setPrecoReais(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Embalagem (R$)</Label>
              <Input
                type="number"
                step={0.01}
                min={0}
                value={embalagemReais}
                onChange={(e) => setEmbalagemReais(e.target.value)}
              />
            </div>
          </div>
          {!completo && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Será criado como rascunho (ativo=false). Complete filamento + peso + tempo no edit
              do produto antes de anunciar.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={virar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={virar.isPending}>
              {virar.isPending
                ? 'Criando…'
                : completo
                  ? 'Criar produto'
                  : 'Criar rascunho'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
