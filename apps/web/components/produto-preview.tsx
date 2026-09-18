import type { CalcularOutput } from '@mahou-hub/contracts';
import { centavosParaReais, pct } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

type CanalKey = 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK';
const CANAL_PREVIEW_LABEL: Record<CanalKey, string> = {
  SHOPEE: 'Shopee',
  ML: 'Mercado Livre',
  SITE: 'Site próprio',
  TIKTOK: 'TikTok Shop',
};

interface CanalPreviewInfo {
  key: CanalKey;
  liquidoCentavos: number;
  margem: number;
  lucroHCentavos: number | null;
  taxaCentavos: number;
}

/**
 * Preview com mesma estética do detail page: veredito + custos por unidade +
 * comparativo de canais. Mais legível que a antiga lista vertical com 18 linhas.
 */
export function ProdutoPreview({
  preview,
  thresholdVerde,
  thresholdAmarelo,
  canal,
  embalagemCentavos,
  custoInsumosCentavos,
  precoCentavos,
}: {
  preview: CalcularOutput;
  thresholdVerde: number;
  thresholdAmarelo: number;
  canal: CanalKey;
  embalagemCentavos: number;
  custoInsumosCentavos: number;
  precoCentavos: number;
}) {
  const margemPrincipal =
    canal === 'SHOPEE'
      ? preview.margemShopee
      : canal === 'ML'
        ? preview.margemMl
        : canal === 'TIKTOK'
          ? preview.margemTikTok
          : preview.margemSite;
  const variant: 'success' | 'warning' | 'danger' =
    margemPrincipal >= thresholdVerde
      ? 'success'
      : margemPrincipal >= thresholdAmarelo
        ? 'warning'
        : 'danger';
  const veredito =
    margemPrincipal >= thresholdVerde
      ? 'Vale a pena'
      : margemPrincipal >= thresholdAmarelo
        ? 'Atenção'
        : 'Não compensa';

  const canais: CanalPreviewInfo[] = [
    {
      key: 'SHOPEE',
      liquidoCentavos: preview.liquidoShopeeCentavos,
      margem: preview.margemShopee,
      lucroHCentavos: preview.lucroPorHoraShopeeCentavos,
      taxaCentavos: preview.taxaShopeeCentavos,
    },
    {
      key: 'ML',
      liquidoCentavos: preview.liquidoMlCentavos,
      margem: preview.margemMl,
      lucroHCentavos: preview.lucroPorHoraMlCentavos,
      taxaCentavos: preview.taxaMlCentavos,
    },
    {
      key: 'SITE',
      liquidoCentavos: preview.liquidoSiteCentavos,
      margem: preview.margemSite,
      lucroHCentavos: preview.lucroPorHoraSiteCentavos,
      taxaCentavos: 0,
    },
    {
      key: 'TIKTOK',
      liquidoCentavos: preview.liquidoTikTokCentavos,
      margem: preview.margemTikTok,
      lucroHCentavos: preview.lucroPorHoraTikTokCentavos,
      taxaCentavos: preview.taxaTikTokCentavos,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={variant} className="text-sm">
          {veredito}
        </Badge>
        <p className="text-sm text-muted-foreground">
          Margem do canal principal ({CANAL_PREVIEW_LABEL[canal]}):{' '}
          <span className="font-semibold text-foreground">{pct(margemPrincipal)}</span>
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Custos por unidade
        </h3>
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <PreviewItem
            rotulo="Filamento"
            valor={centavosParaReais(preview.custoFilamentoCentavos)}
          />
          <PreviewItem rotulo="Energia" valor={centavosParaReais(preview.custoEnergiaCentavos)} />
          <PreviewItem rotulo="Embalagem" valor={centavosParaReais(embalagemCentavos)} />
          <PreviewItem rotulo="Insumos" valor={centavosParaReais(custoInsumosCentavos)} />
          <PreviewItem rotulo="Imposto" valor={centavosParaReais(preview.impostoCentavos)} />
          <PreviewItem
            rotulo="Custo total"
            valor={centavosParaReais(preview.custoTotalProducaoCentavos)}
            destaque
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Por canal
          </h3>
          <span className="text-xs text-muted-foreground">
            Preço de venda: {centavosParaReais(precoCentavos)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canais.map((c) => (
            <CanalPreviewCard
              key={c.key}
              info={c}
              principal={c.key === canal}
              thresholdVerde={thresholdVerde}
              thresholdAmarelo={thresholdAmarelo}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function CanalPreviewCard({
  info,
  principal,
  thresholdVerde,
  thresholdAmarelo,
}: {
  info: CanalPreviewInfo;
  principal: boolean;
  thresholdVerde: number;
  thresholdAmarelo: number;
}) {
  const v: 'success' | 'warning' | 'danger' =
    info.margem >= thresholdVerde
      ? 'success'
      : info.margem >= thresholdAmarelo
        ? 'warning'
        : 'danger';
  return (
    <div
      className={
        'rounded-lg border p-4 transition-colors ' +
        (principal ? 'border-primary/60 bg-primary/5' : 'border-border bg-card/50')
      }
    >
      <div className="mb-3 flex items-center justify-between text-sm font-medium">
        <span>{CANAL_PREVIEW_LABEL[info.key]}</span>
        {principal && <span className="text-xs text-primary-foreground">principal</span>}
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Líquido</div>
          <div className="text-xl font-semibold tabular-nums">
            {centavosParaReais(info.liquidoCentavos)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Margem</div>
            <Badge variant={v} className="font-normal">
              {pct(info.margem)}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Lucro/h</div>
            <div className="tabular-nums">
              {info.lucroHCentavos != null ? centavosParaReais(info.lucroHCentavos) : '—'}
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          Taxa:{' '}
          <span className="tabular-nums text-foreground">
            {info.taxaCentavos > 0 ? centavosParaReais(info.taxaCentavos) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewItem({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center justify-between gap-3 ' +
        (destaque ? 'border-t border-border pt-2 font-semibold' : '')
      }
    >
      <span className={destaque ? 'text-foreground' : 'text-muted-foreground'}>{rotulo}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}
