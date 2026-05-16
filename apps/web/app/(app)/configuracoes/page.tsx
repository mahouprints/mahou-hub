'use client';

import { useQuery } from '@tanstack/react-query';
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Parâmetros globais, filamentos e tabelas de taxas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros globais</CardTitle>
          <CardDescription>Valores aplicados em todos os cálculos</CardDescription>
        </CardHeader>
        <CardContent>
          {parametros.data ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Linha rotulo="Tarifa kWh" valor={centavosParaReais(parametros.data.tarifaKwhCentavos)} />
              <Linha rotulo="Vendedor Shopee" valor={parametros.data.vendedorShopee} />
              <Linha
                rotulo="Em campanha"
                valor={parametros.data.emCampanhaShopee ? 'Sim' : 'Não'}
              />
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
        <CardHeader>
          <CardTitle>Filamentos</CardTitle>
          <CardDescription>{filamentos.data?.length ?? 0} cadastrados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Custo/kg</TableHead>
                <TableHead className="text-right">Potência A1</TableHead>
                <TableHead className="text-right">Potência H2C</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filamentos.data?.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {centavosParaReais(f.custoKgCentavos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{f.potenciaA1W}W</TableCell>
                  <TableCell className="text-right tabular-nums">{f.potenciaH2cW}W</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas Shopee</CardTitle>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas Mercado Livre</CardTitle>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
