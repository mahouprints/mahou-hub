'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { FaixaMercadoLivre, FaixaShopee, Filamento, Parametro } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FilamentoDialog } from '@/components/filamento-dialog';
import { TaxaShopeeDialog } from '@/components/taxa-shopee-dialog';
import { TaxaMlDialog } from '@/components/taxa-ml-dialog';
import { ParametrosDialog } from '@/components/parametros-dialog';
import { ApiTokenCard } from '@/components/api-token-card';
import { Pagination } from '@/components/pagination';
import { useTablePagination } from '@/lib/use-table-pagination';

export default function ConfiguracoesPage() {
  const parametros = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });
  const filamentos = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });
  const taxasShopee = useQuery({
    queryKey: ['taxas-shopee'],
    queryFn: () => apiFetch<FaixaShopee[]>('/parametros/taxas/shopee'),
  });
  const taxasMl = useQuery({
    queryKey: ['taxas-ml'],
    queryFn: () => apiFetch<FaixaMercadoLivre[]>('/parametros/taxas/ml'),
  });

  // Paginação só pra filamentos. Taxas Shopee/ML são tabelas de configuração de
  // tamanho conhecido (faixas A–E, ~6 faixas Shopee) — paginar não faz sentido.
  const filPag = useTablePagination();
  const filamentosPaginados = filPag.paginar(filamentos.data ?? []);

  const [filDialog, setFilDialog] = useState<{ open: boolean; item: Filamento | null }>({ open: false, item: null });
  const [shopeeDialog, setShopeeDialog] = useState<{ open: boolean; item: FaixaShopee | null }>({ open: false, item: null });
  const [mlDialog, setMlDialog] = useState<{ open: boolean; item: FaixaMercadoLivre | null }>({ open: false, item: null });
  const [paramsDialog, setParamsDialog] = useState(false);

  const qc = useQueryClient();
  const desativarFilamento = useMutation({
    mutationFn: (id: string) => apiFetch(`/filamentos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filamentos'] }),
  });
  const deletarShopee = useMutation({
    mutationFn: (id: string) => apiFetch(`/parametros/taxas/shopee/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxas-shopee'] }),
  });
  const deletarMl = useMutation({
    mutationFn: (id: string) => apiFetch(`/parametros/taxas/ml/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxas-ml'] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Parâmetros globais, filamentos e tabelas de taxas.</p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Parâmetros globais</CardTitle>
            <CardDescription>Valores aplicados em todos os cálculos</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setParamsDialog(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        </CardHeader>
        <CardContent>
          {parametros.data ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Linha rotulo="Tarifa kWh" valor={centavosParaReais(parametros.data.tarifaKwhCentavos)} />
              <Linha rotulo="Vendedor Shopee" valor={parametros.data.vendedorShopee} />
              <Linha rotulo="Em campanha" valor={parametros.data.emCampanhaShopee ? 'Sim' : 'Não'} />
              <Linha rotulo="Adicional campanha" valor={`${parametros.data.adicionalCampanhaPct}%`} />
              <Linha rotulo="Comissão ML" valor={`${parametros.data.comissaoMlPct}%`} />
              <Linha
                rotulo="Imposto"
                valor={parametros.data.impostoAtivo ? `${parametros.data.impostoPct}%` : 'Inativo'}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Filamentos</CardTitle>
            <CardDescription>{filamentos.data?.length ?? 0} cadastrados</CardDescription>
          </div>
          <Button size="sm" onClick={() => setFilDialog({ open: true, item: null })}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Custo/kg</TableHead>
                <TableHead className="text-right">Potência A1</TableHead>
                <TableHead className="text-right">Potência H2C</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filamentosPaginados.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{centavosParaReais(f.custoKgCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.potenciaA1W}W</TableCell>
                  <TableCell className="text-right tabular-nums">{f.potenciaH2cW}W</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{f.observacao ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setFilDialog({ open: true, item: f })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Desativar ${f.nome}?`)) desativarFilamento.mutate(f.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={filPag.page}
            pageSize={filPag.pageSize}
            total={filamentos.data?.length ?? 0}
            onPageChange={filPag.setPage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Taxas Shopee</CardTitle>
          <Button size="sm" onClick={() => setShopeeDialog({ open: true, item: null })}>
            <Plus className="h-4 w-4" /> Nova faixa
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Limite inferior</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="text-right">Fixa CNPJ</TableHead>
                <TableHead className="text-right">Fixa CPF baixo</TableHead>
                <TableHead className="text-right">Fixa CPF alto</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxasShopee.data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="tabular-nums">{centavosParaReais(t.limInferiorCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.comissaoPct}%</TableCell>
                  <TableCell className="text-right tabular-nums">{centavosParaReais(t.fixaCnpjCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{centavosParaReais(t.fixaCpfBaixoCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{centavosParaReais(t.fixaCpfAltoCentavos)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setShopeeDialog({ open: true, item: t })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Apagar esta faixa?')) deletarShopee.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Taxas Mercado Livre</CardTitle>
          <Button size="sm" onClick={() => setMlDialog({ open: true, item: null })}>
            <Plus className="h-4 w-4" /> Nova faixa
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faixa</TableHead>
                <TableHead>Limite inferior</TableHead>
                <TableHead className="text-right">Custo fixo</TableHead>
                <TableHead className="text-right">% alternativo</TableHead>
                <TableHead className="text-right">Comissão categoria</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxasMl.data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.faixa}</TableCell>
                  <TableCell className="tabular-nums">{centavosParaReais(t.limInferiorCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{centavosParaReais(t.custoFixoCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.pctAlternativo}%</TableCell>
                  <TableCell className="text-right tabular-nums">{t.comissaoCategoriaPct}%</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setMlDialog({ open: true, item: t })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Apagar esta faixa?')) deletarMl.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ApiTokenCard />

      <ParametrosDialog
        open={paramsDialog}
        onOpenChange={setParamsDialog}
        parametros={parametros.data ?? null}
      />
      <FilamentoDialog
        open={filDialog.open}
        onOpenChange={(o) => setFilDialog({ open: o, item: o ? filDialog.item : null })}
        filamento={filDialog.item}
      />
      <TaxaShopeeDialog
        open={shopeeDialog.open}
        onOpenChange={(o) => setShopeeDialog({ open: o, item: o ? shopeeDialog.item : null })}
        faixa={shopeeDialog.item}
      />
      <TaxaMlDialog
        open={mlDialog.open}
        onOpenChange={(o) => setMlDialog({ open: o, item: o ? mlDialog.item : null })}
        faixa={mlDialog.item}
      />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right tabular-nums">{valor}</dd>
    </>
  );
}
