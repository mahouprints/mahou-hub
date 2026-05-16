'use client';

import { useQuery } from '@tanstack/react-query';
import type { FaixaMercadoLivre, FaixaShopee, Filamento, Parametro } from '@mahou-hub/contracts';
import { apiFetch } from '../../../lib/api-client';
import { centavosParaReais } from '../../../lib/format';

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
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-mahou-mute">Parâmetros globais, filamentos e tabelas de taxas.</p>
      </header>

      <Bloco titulo="Parâmetros globais">
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
            <Linha rotulo="Imposto" valor={parametros.data.impostoAtivo ? `${parametros.data.impostoPct}%` : 'Inativo'} />
          </dl>
        ) : (
          <p className="text-sm text-mahou-mute">Carregando…</p>
        )}
      </Bloco>

      <Bloco titulo={`Filamentos (${filamentos.data?.length ?? 0})`}>
        <ul className="text-sm divide-y divide-mahou-line">
          {filamentos.data?.map((f) => (
            <li key={f.id} className="py-2 flex justify-between">
              <span>{f.nome}</span>
              <span className="text-mahou-mute">
                {centavosParaReais(f.custoKgCentavos)}/kg · A1 {f.potenciaA1W}W · H2C {f.potenciaH2cW}W
              </span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Taxas Shopee">
        <Tabela
          colunas={['Limite inferior', 'Comissão', 'Fixa CNPJ', 'Fixa CPF baixo', 'Fixa CPF alto']}
          linhas={
            taxasShopee.data?.map((t) => [
              centavosParaReais(t.limInferiorCentavos),
              `${t.comissaoPct}%`,
              centavosParaReais(t.fixaCnpjCentavos),
              centavosParaReais(t.fixaCpfBaixoCentavos),
              centavosParaReais(t.fixaCpfAltoCentavos),
            ]) ?? []
          }
        />
      </Bloco>

      <Bloco titulo="Taxas Mercado Livre">
        <Tabela
          colunas={['Faixa', 'Limite inferior', 'Custo fixo', '% alternativo', 'Comissão categoria']}
          linhas={
            taxasMl.data?.map((t) => [
              t.faixa,
              centavosParaReais(t.limInferiorCentavos),
              centavosParaReais(t.custoFixoCentavos),
              `${t.pctAlternativo}%`,
              `${t.comissaoCategoriaPct}%`,
            ]) ?? []
          }
        />
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <>
      <dt className="text-mahou-mute">{rotulo}</dt>
      <dd className="text-right">{valor}</dd>
    </>
  );
}

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-mahou-mute">
        <tr>
          {colunas.map((c) => (
            <th key={c} className="py-2 font-medium">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} className="border-t border-mahou-line">
            {linha.map((celula, j) => (
              <td key={j} className="py-2">
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
