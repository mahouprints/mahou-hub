'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
import type { Filamento, Insumo } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, tempoRelativo } from '@/lib/format';
import { cn, normalizarBusca } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MovimentoDialog } from '@/components/movimento-dialog';
import { CustoFilamentoDialog } from '@/components/custo-filamento-dialog';

type AlertaEstoque = {
  tipo: string;
  id: string;
  nome: string;
  unidade: string;
  saldo: number;
  minimo: number;
};
type InsumoComEstoque = Insumo & { _count?: { produtos: number } };
type ItemMov = {
  tipoItem: 'FILAMENTO' | 'INSUMO';
  id: string;
  nome: string;
  unidade: string;
  saldo: number;
};
type Movimento = {
  id: string;
  tipoItem: 'PRODUTO' | 'FILAMENTO' | 'INSUMO';
  quantidade: number;
  saldoApos: number;
  motivo: string;
  observacao: string | null;
  criadoEm: string;
  variacao: { nome: string; produto: { nome: string } } | null;
  filamento: { nome: string } | null;
  insumo: { nome: string; unidade: string } | null;
};
type Aba = 'saldos' | 'historico' | 'custos';

const INVALIDAR: unknown[][] = [
  ['estoque', 'alertas'],
  ['estoque', 'movimentos'],
  ['filamentos'],
  ['insumos'],
];
const MOTIVO_LABEL: Record<string, string> = {
  ESTOQUE_INICIAL: 'Estoque inicial',
  COMPRA: 'Compra',
  PRODUCAO: 'Produção',
  VENDA: 'Venda',
  AJUSTE: 'Ajuste',
  PERDA: 'Perda',
};

function comKg(g: number): string {
  return `${g.toLocaleString('pt-BR')} g · ${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
}

export default function EstoquePage() {
  const [aba, setAba] = useState<Aba>('saldos');
  const [mov, setMov] = useState<ItemMov | null>(null);
  const [custoEdit, setCustoEdit] = useState<Filamento | null>(null);
  const [buscaFilamento, setBuscaFilamento] = useState('');

  const alertas = useQuery({
    queryKey: ['estoque', 'alertas'],
    queryFn: () => apiFetch<AlertaEstoque[]>('/estoque/alertas'),
  });
  const filamentos = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });
  const insumos = useQuery({
    queryKey: ['insumos'],
    queryFn: () => apiFetch<InsumoComEstoque[]>('/insumos'),
  });
  const movimentos = useQuery({
    queryKey: ['estoque', 'movimentos'],
    queryFn: () => apiFetch<Movimento[]>('/estoque/movimentos?limit=80'),
  });

  const filamentosAtivos = filamentos.data?.filter((f) => f.ativo) ?? [];
  const buscaNorm = normalizarBusca(buscaFilamento.trim());
  const filamentosFiltrados = buscaNorm
    ? filamentosAtivos.filter((f) => normalizarBusca(f.nome).includes(buscaNorm))
    : filamentosAtivos;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Matéria-prima da Mahou. Entradas e baixas atualizam o saldo na hora; o sistema avisa
          quando algo chega no nível de reposição.
        </p>
      </header>

      {alertas.data && alertas.data.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {alertas.data.length} item(ns) no nível de reposição — hora de comprar
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {alertas.data.map((a) => (
              <li key={`${a.tipo}-${a.id}`} className="flex items-center justify-between">
                <span>{a.nome}</span>
                <span className="tabular-nums text-muted-foreground">
                  {a.saldo} / mín {a.minimo} {a.unidade}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['saldos', 'Saldos'],
            ['historico', 'Histórico'],
            ['custos', 'Custos'],
          ] as [Aba, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
              aba === k
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'saldos' && (
        <div className="space-y-6">
          <Secao
            titulo="Filamentos"
            acao={
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscaFilamento}
                  onChange={(e) => setBuscaFilamento(e.target.value)}
                  placeholder="Buscar filamento…"
                  className="h-9 pl-8"
                />
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filamento</TableHead>
                  <TableHead className="text-right">Em estoque</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filamentosFiltrados.map((f) => {
                  const baixo = f.estoqueMinGramas > 0 && f.estoqueGramas <= f.estoqueMinGramas;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={baixo ? 'font-medium text-amber-600 dark:text-amber-500' : ''}
                        >
                          {comKg(f.estoqueGramas)}
                        </span>
                        {baixo && (
                          <Badge variant="default" className="ml-2 bg-amber-500/15 text-amber-600">
                            baixo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {f.estoqueMinGramas > 0 ? `${f.estoqueMinGramas} g` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setMov({
                              tipoItem: 'FILAMENTO',
                              id: f.id,
                              nome: f.nome,
                              unidade: 'g',
                              saldo: f.estoqueGramas,
                            })
                          }
                        >
                          Movimentar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filamentosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {buscaNorm ? 'Nenhum filamento encontrado.' : 'Nenhum filamento cadastrado.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Secao>

          <Secao titulo="Insumos">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Em estoque</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insumos.data?.map((i) => {
                  const baixo = i.estoqueMinimo > 0 && i.estoqueAtual <= i.estoqueMinimo;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={baixo ? 'font-medium text-amber-600 dark:text-amber-500' : ''}
                        >
                          {i.estoqueAtual} {i.unidade}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {i.estoqueMinimo > 0 ? `${i.estoqueMinimo} ${i.unidade}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setMov({
                              tipoItem: 'INSUMO',
                              id: i.id,
                              nome: i.nome,
                              unidade: i.unidade,
                              saldo: i.estoqueAtual,
                            })
                          }
                        >
                          Movimentar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Secao>
        </div>
      )}

      {aba === 'historico' && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Movimento</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.data?.map((m) => {
                const nome =
                  m.filamento?.nome ??
                  m.insumo?.nome ??
                  (m.variacao ? `${m.variacao.produto.nome} — ${m.variacao.nome}` : '—');
                const un =
                  m.tipoItem === 'FILAMENTO'
                    ? 'g'
                    : m.tipoItem === 'PRODUTO'
                      ? 'un'
                      : (m.insumo?.unidade ?? '');
                const entrada = m.quantidade > 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {tempoRelativo(m.criadoEm)}
                    </TableCell>
                    <TableCell className="font-medium">{nome}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium tabular-nums',
                        entrada
                          ? 'text-emerald-600 dark:text-emerald-500'
                          : 'text-rose-600 dark:text-rose-500',
                      )}
                    >
                      {entrada ? '+' : ''}
                      {m.quantidade.toLocaleString('pt-BR')} {un}
                    </TableCell>
                    <TableCell>{MOTIVO_LABEL[m.motivo] ?? m.motivo}</TableCell>
                    <TableCell className="text-muted-foreground">{m.observacao ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
              {movimentos.data && movimentos.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nenhuma movimentação ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {aba === 'custos' && (
        <Secao titulo="Custo por kg dos filamentos">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filamento</TableHead>
                <TableHead className="text-right">Custo por kg</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filamentosAtivos.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {centavosParaReais(f.custoKgCentavos)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setCustoEdit(f)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Secao>
      )}

      {mov && (
        <MovimentoDialog
          tipoItem={mov.tipoItem}
          itemId={mov.id}
          itemNome={mov.nome}
          unidade={mov.unidade}
          saldoAtual={mov.saldo}
          open={!!mov}
          onOpenChange={(v) => {
            if (!v) setMov(null);
          }}
          invalidar={INVALIDAR}
        />
      )}
      {custoEdit && (
        <CustoFilamentoDialog
          filamento={custoEdit}
          open={!!custoEdit}
          onOpenChange={(v) => {
            if (!v) setCustoEdit(null);
          }}
        />
      )}
    </div>
  );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h2>
        {acao}
      </div>
      <Card>{children}</Card>
    </section>
  );
}
