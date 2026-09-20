'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Settings } from 'lucide-react';
import { toast } from 'sonner';
import type { PeriodoRelatorio, RelatorioFinanceiro } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import {
  RelatoriosConfiguracao,
  type ConfiguracaoRelatorios,
} from '@/components/relatorios-configuracao';
import { RelatoriosEnvios, type EnvioRelatorio } from '@/components/relatorios-envios';
import { RelatoriosGraficos } from '@/components/relatorios-graficos';
import { RelatoriosTabelas } from '@/components/relatorios-tabelas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function diaAtualBahia() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const campo = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value;
  return `${campo('year')}-${campo('month')}-${campo('day')}`;
}
function formatarDia(dia: string) {
  return dia.split('-').reverse().join('/');
}
function dataCivil(instante: Date) {
  return `${instante.getFullYear()}-${String(instante.getMonth() + 1).padStart(2, '0')}-${String(instante.getDate()).padStart(2, '0')}`;
}

/** Explora o período e acompanha a entrega do relatório. Ex.: /financeiro/relatorios. */
export default function RelatoriosPage() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('MENSAL');
  const [referencia, setReferencia] = useState(diaAtualBahia);
  const relatorio = useQuery({
    queryKey: ['financeiro-relatorio', periodo, referencia],
    queryFn: () =>
      apiFetch<RelatorioFinanceiro>(
        `/financeiro/relatorio?periodo=${periodo}&referencia=${referencia}`,
      ),
  });
  const configuracao = useQuery({
    queryKey: ['relatorios-configuracao'],
    queryFn: () => apiFetch<ConfiguracaoRelatorios>('/relatorios/configuracao'),
  });
  const envios = useQuery({
    queryKey: ['relatorios-envios'],
    queryFn: () => apiFetch<EnvioRelatorio[]>('/relatorios/envios'),
    refetchInterval: (consulta) =>
      consulta.state.data?.some(
        (envio) => envio.status === 'PROCESSANDO' || envio.status === 'PENDENTE',
      )
        ? 5000
        : false,
  });
  const enviar = useMutation({
    mutationFn: () =>
      apiFetch<EnvioRelatorio>('/relatorios/enviar', {
        method: 'POST',
        json: { periodo, referencia },
      }),
    onSuccess: async (envio) => {
      await qc.invalidateQueries({ queryKey: ['relatorios-envios'] });
      if (envio.status === 'ENVIADO')
        toast.success('Relatório disponível. Abra a planilha no histórico.');
      else if (envio.status === 'FALHOU')
        toast.error(envio.erro ?? 'Não foi possível enviar o relatório');
      else toast.success('Relatório solicitado. Acompanhe o resultado no histórico.');
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-muted-foreground">
          <Link href="/financeiro">
            <ArrowLeft className="size-4" /> Financeiro
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Relatórios financeiros</h1>
            <p className="text-sm text-muted-foreground">
              Receita, gastos e resultado por dia, semana, mês ou ano.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="#configurar-relatorios">
              <Settings className="size-4" /> Configurar envios
            </a>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44 space-y-1.5">
              <label htmlFor="relatorio-periodo" className="text-sm font-medium">
                Período
              </label>
              <Select
                value={periodo}
                onValueChange={(valor) => setPeriodo(valor as PeriodoRelatorio)}
              >
                <SelectTrigger id="relatorio-periodo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIARIO">Diário</SelectItem>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                  <SelectItem value="MENSAL">Mensal</SelectItem>
                  <SelectItem value="ANUAL">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div role="group" aria-labelledby="relatorio-referencia" className="w-64 space-y-1.5">
              <p id="relatorio-referencia" className="text-sm font-medium">
                Data de referência
              </p>
              <DatePicker
                value={new Date(`${referencia}T12:00:00`)}
                onChange={(dia) => {
                  if (dia) setReferencia(dataCivil(dia));
                }}
              />
            </div>
            <Button
              onClick={() => enviar.mutate()}
              disabled={
                !configuracao.data?.googleConfigurado ||
                !!configuracao.error ||
                !!relatorio.error ||
                !relatorio.data ||
                relatorio.isFetching ||
                enviar.isPending
              }
            >
              <Mail className="size-4" />{' '}
              {enviar.isPending ? 'Preparando relatório…' : 'Gerar planilha e enviar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A data identifica o dia, a semana, o mês ou o ano consultado. Relatórios diários são
            enviados manualmente. Períodos em andamento geram uma prévia por dia. Relatórios já
            enviados abrem a mesma planilha, sem novo e-mail.
          </p>
          {configuracao.data && !configuracao.data.googleConfigurado && (
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Google em{' '}
              <a className="underline" href="#configurar-relatorios">
                Configurar envios
              </a>{' '}
              para criar planilhas e enviá-las por e-mail. A consulta abaixo já pode ser usada.
            </p>
          )}
          {enviar.error && (
            <p role="alert" className="text-sm text-destructive">
              {enviar.error.message}
            </p>
          )}
          {enviar.data?.planilhaUrl && (
            <p className="text-sm">
              <a
                href={enviar.data.planilhaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Abrir a planilha do último envio
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {relatorio.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando relatório…
        </p>
      )}
      {relatorio.error && (
        <ErroConsulta
          mensagem="Não foi possível carregar o relatório financeiro."
          erro={relatorio.error}
          tentar={() => void relatorio.refetch()}
        />
      )}
      {relatorio.data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{relatorio.data.titulo}</h2>
              <p className="text-sm text-muted-foreground">
                {formatarDia(relatorio.data.inicio)} a {formatarDia(relatorio.data.fim)}
              </p>
            </div>
            {relatorio.data.vendas.length === 0 && relatorio.data.custosGerais.length === 0 && (
              <Badge variant="secondary">Sem lançamentos no período</Badge>
            )}
          </div>
          <IndicadoresRelatorio relatorio={relatorio.data} />
          <RelatoriosGraficos relatorio={relatorio.data} />
          <RelatoriosTabelas relatorio={relatorio.data} />
        </>
      )}

      {configuracao.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando configuração dos envios…
        </p>
      )}
      {configuracao.error && (
        <ErroConsulta
          mensagem="Não foi possível carregar a configuração Google."
          erro={configuracao.error}
          tentar={() => void configuracao.refetch()}
        />
      )}
      {configuracao.data && (
        <RelatoriosConfiguracao
          key={JSON.stringify(configuracao.data)}
          configuracao={configuracao.data}
          onSalvo={() => qc.invalidateQueries({ queryKey: ['relatorios-configuracao'] })}
        />
      )}
      {envios.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando histórico de envios…
        </p>
      )}
      {envios.error && (
        <ErroConsulta
          mensagem="Não foi possível carregar o histórico de envios."
          erro={envios.error}
          tentar={() => void envios.refetch()}
        />
      )}
      {envios.data && <RelatoriosEnvios envios={envios.data} />}
    </div>
  );
}

function IndicadoresRelatorio({ relatorio }: { relatorio: RelatorioFinanceiro }) {
  const resumo = relatorio.resumo;
  const indicadores = [
    {
      rotulo: 'Faturamento',
      valor: centavosParaReais(resumo.faturamentoCentavos),
      apoio: `${resumo.qtdVendas} vendas · ${resumo.qtdItensVendidos} unidades`,
    },
    {
      rotulo: 'Gastos totais',
      valor: centavosParaReais(resumo.gastosTotaisCentavos),
      apoio: 'Produção, insumos, impostos, taxas e custos gerais',
    },
    {
      rotulo: 'Lucro líquido',
      valor: centavosParaReais(resumo.lucroLiquidoCentavos),
      apoio: 'Após todos os gastos do período',
    },
    {
      rotulo: 'Margem líquida',
      valor: pct(resumo.margem),
      apoio:
        resumo.faturamentoCentavos === 0
          ? 'Sem faturamento no período'
          : 'Lucro líquido sobre o faturamento',
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {indicadores.map((indicador) => (
        <Card key={indicador.rotulo}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {indicador.rotulo}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{indicador.valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{indicador.apoio}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErroConsulta({
  mensagem,
  erro,
  tentar,
}: {
  mensagem: string;
  erro: Error;
  tentar: () => void;
}) {
  return (
    <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-4 text-sm">
      <p className="font-medium text-destructive">{mensagem}</p>
      <p className="text-muted-foreground">{erro.message}</p>
      <Button variant="outline" size="sm" onClick={tentar}>
        Tentar novamente
      </Button>
    </div>
  );
}
