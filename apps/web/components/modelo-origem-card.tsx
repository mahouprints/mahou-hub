'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, Ruler } from 'lucide-react';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type ModeloOrigem = {
  id: string;
  titulo: string;
  url: string;
  autor: string;
  licenca: string;
  licencaObrigacao: string;
  pesoGramas: number | string;
  tempoHoras: number | string;
  unidadesPorKit: number;
  custoEstimadoCentavos: number;
  precoSugeridoCentavos: number;
  alertas: string[];
  nicho: string;
  notaIa: number;
  temFotoReal: boolean;
};

interface Props {
  modelo: ModeloOrigem;
  produto: {
    pesoG: number | string;
    tempoH: number | string;
    precoCentavos: number;
    larguraCm: number | string | null;
    alturaCm: number | string | null;
    profundidadeCm: number | string | null;
  };
}

/**
 * Ficha do modelo que originou o produto, lado a lado com o que foi cadastrado.
 *
 * Existe pra conferência: peso digitado errado passa despercebido no cadastro e só
 * aparece quando o rolo acaba antes da conta fechar. E a licença exige crédito ao autor
 * na descrição em tudo que não é CC0 — esquecer disso é motivo de takedown.
 */
export function ModeloOrigemCard({ modelo, produto }: Props) {
  const divergencias = [
    diferenca('Peso', Number(produto.pesoG), Number(modelo.pesoGramas), 'g'),
    diferenca('Tempo', Number(produto.tempoH), Number(modelo.tempoHoras), 'h'),
  ].filter((d): d is string => d !== null);

  const semDimensoes =
    produto.larguraCm == null && produto.alturaCm == null && produto.profundidadeCm == null;
  const exigeCredito = modelo.licenca.toUpperCase() !== 'CC0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Modelo de origem</span>
          <Badge variant="outline" className="text-[10px]">
            nota {modelo.notaIa}
          </Badge>
        </CardTitle>
        <CardDescription>
          O que a prospecção mediu, pra conferir contra o que foi cadastrado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Autor</dt>
          <dd>{modelo.autor}</dd>
          <dt className="text-muted-foreground">Peso do modelo</dt>
          <dd>{Number(modelo.pesoGramas)} g</dd>
          <dt className="text-muted-foreground">Tempo do modelo</dt>
          <dd>{Number(modelo.tempoHoras)} h</dd>
          {modelo.unidadesPorKit > 1 && (
            <>
              <dt className="text-muted-foreground">Peças por kit</dt>
              <dd>{modelo.unidadesPorKit}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Custo estimado</dt>
          <dd>{centavosParaReais(modelo.custoEstimadoCentavos)}</dd>
          <dt className="text-muted-foreground">Preço sugerido</dt>
          <dd>
            {centavosParaReais(modelo.precoSugeridoCentavos)}
            {modelo.precoSugeridoCentavos !== produto.precoCentavos && (
              <span className="ml-2 text-xs text-muted-foreground">
                (cadastrado: {centavosParaReais(produto.precoCentavos)})
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Licença</dt>
          <dd>{modelo.licenca}</dd>
        </dl>

        {divergencias.length > 0 && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              O cadastro difere do modelo em: {divergencias.join(' · ')}. Se foi de propósito
              (você remodelou ou mediu a peça impressa), ignore.
            </p>
          </div>
        )}

        {semDimensoes && (
          <div className="flex gap-2 rounded-md border border-border p-2.5 text-xs">
            <Ruler className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Sem dimensões cadastradas. O MakerWorld não informa largura, altura e
              profundidade — meça a peça impressa e preencha, porque é o que o marketplace
              usa pra calcular frete.
            </p>
          </div>
        )}

        {exigeCredito && (
          <div className="rounded-md border border-border p-2.5 text-xs">
            <p className="font-medium">Obrigação da licença</p>
            <p className="mt-0.5 text-muted-foreground">{modelo.licencaObrigacao}</p>
          </div>
        )}

        {modelo.alertas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {modelo.alertas.map((a) => (
              <Badge key={a} variant="outline" className="text-[10px]">
                {a.toLowerCase().replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/makerworld/${modelo.id}`} className="text-primary hover:underline">
            Abrir na aba MakerWorld
          </Link>
          <a
            href={modelo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            Ver original <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

/** Diferença que vale avisar: acima de 5% é digitação errada, abaixo é arredondamento. */
function diferenca(rotulo: string, cadastrado: number, doModelo: number, unidade: string) {
  if (!doModelo || !cadastrado) return null;
  const variacao = Math.abs(cadastrado - doModelo) / doModelo;
  if (variacao < 0.05) return null;
  return `${rotulo} ${cadastrado}${unidade} vs ${doModelo}${unidade}`;
}
