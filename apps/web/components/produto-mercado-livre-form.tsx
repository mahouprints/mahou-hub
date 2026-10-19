'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  MercadoLivreConfiguracaoSchema,
  type MercadoLivreConfiguracao,
} from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

type Categoria = { id: string; nome: string };
type Props = {
  titulo: string;
  value: MercadoLivreConfiguracao | null;
  onChange: (value: MercadoLivreConfiguracao | null) => void;
};

const INICIAL: MercadoLivreConfiguracao = {
  categoriaId: '',
  tipoAnuncio: 'gold_special',
  modoEnvio: 'me2',
  tipoLogistica: 'drop_off',
  freteGratis: false,
  condicao: 'new',
};

/** Planeja categoria e pacote antes da cotação; não publica nem altera anúncios no marketplace. */
export function ProdutoMercadoLivreForm({ titulo, value, onChange }: Props) {
  const [itemId, setItemId] = useState(value?.itemId ?? '');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [caminho, setCaminho] = useState('');
  const buscar = useMutation({
    mutationFn: () =>
      apiFetch<Categoria[]>(`/mercado-livre/categorias?q=${encodeURIComponent(titulo)}`),
    onSuccess: setCategorias,
  });
  const validar = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; nome: string; caminho: Categoria[]; permiteAnunciar: boolean }>(
        `/mercado-livre/categorias/${id}`,
      ),
    onSuccess: (categoria) => {
      setCaminho(
        categoria.permiteAnunciar
          ? categoria.caminho.map((parte) => parte.nome).join(' > ')
          : 'Categoria não permite anúncios. Escolha uma categoria final.',
      );
    },
  });
  const carregar = useMutation({
    mutationFn: async () => {
      const anuncio = await apiFetch<unknown>(
        `/mercado-livre/anuncios/${itemId.trim().toUpperCase()}`,
      );
      const config = MercadoLivreConfiguracaoSchema.safeParse(anuncio);
      if (!config.success)
        throw new Error(
          'Este anúncio possui condições ainda não suportadas pela cotação. Confira o tipo de anúncio e o Mercado Envios.',
        );
      return config.data;
    },
    onSuccess: (config) => {
      onChange(config);
      validar.mutate(config.categoriaId);
    },
  });

  function alterar<K extends keyof MercadoLivreConfiguracao>(
    campo: K,
    valor: MercadoLivreConfiguracao[K],
  ) {
    onChange({ ...(value ?? INICIAL), [campo]: valor });
    if (campo === 'categoriaId') setCaminho('');
  }

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label="Condições do Mercado Livre">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(event) => onChange(event.target.checked ? { ...INICIAL } : null)}
        />
        Preparar categoria e custos do Mercado Livre
      </label>
      {value && (
        <>
          {(buscar.error || validar.error || carregar.error) && (
            <p role="alert" className="text-sm text-destructive">
              {(buscar.error || validar.error || carregar.error)?.message}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            A categoria, o preço, o tipo de anúncio e a logística determinam as tarifas. Salve o
            produto e consulte os custos na página dele.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="ml-item">Anúncio existente (opcional)</Label>
              <Input
                id="ml-item"
                value={itemId}
                placeholder="MLB4971082829"
                onChange={(event) => setItemId(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!/^MLB\d+$/i.test(itemId.trim()) || carregar.isPending}
              onClick={() => carregar.mutate()}
            >
              Carregar condições do anúncio
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="ml-categoria">Categoria Mercado Livre</Label>
              <Input
                id="ml-categoria"
                value={value.categoriaId}
                placeholder="ID da categoria (MLB...)"
                onChange={(event) =>
                  alterar('categoriaId', event.target.value.trim().toUpperCase())
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!titulo.trim() || buscar.isPending}
              onClick={() => buscar.mutate()}
            >
              Sugerir pelo nome
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!/^MLB\d+$/.test(value.categoriaId) || validar.isPending}
              onClick={() => validar.mutate(value.categoriaId)}
            >
              Conferir categoria
            </Button>
          </div>
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categorias.map((categoria) => (
                <Button
                  key={categoria.id}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    alterar('categoriaId', categoria.id);
                    validar.mutate(categoria.id);
                  }}
                >
                  {categoria.nome} ({categoria.id})
                </Button>
              ))}
            </div>
          )}
          {caminho && (
            <p className="text-sm" role="status">
              {caminho}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ml-tipo">Tipo de anúncio</Label>
              <select
                id="ml-tipo"
                className="w-full rounded-md border bg-background p-2"
                value={value.tipoAnuncio}
                onChange={(event) =>
                  alterar(
                    'tipoAnuncio',
                    event.target.value as MercadoLivreConfiguracao['tipoAnuncio'],
                  )
                }
              >
                <option value="gold_special">Clássico</option>
                <option value="gold_pro">Premium</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ml-logistica">Logística</Label>
              <select
                id="ml-logistica"
                className="w-full rounded-md border bg-background p-2"
                value={value.tipoLogistica}
                onChange={(event) => alterar('tipoLogistica', event.target.value)}
              >
                <option value="drop_off">Agência Mercado Livre</option>
                <option value="xd_drop_off">Agência com coleta</option>
                <option value="cross_docking">Coleta</option>
                <option value="self_service">Flex</option>
                <option value="fulfillment">Full</option>
                {![
                  'drop_off',
                  'xd_drop_off',
                  'cross_docking',
                  'self_service',
                  'fulfillment',
                ].includes(value.tipoLogistica) && (
                  <option value={value.tipoLogistica}>{value.tipoLogistica}</option>
                )}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.freteGratis}
              onChange={(event) => alterar('freteGratis', event.target.checked)}
            />
            Frete grátis para o comprador
          </label>
          <p className="text-xs text-muted-foreground">
            Confira as modalidades disponíveis para sua conta. Frete grátis ao comprador pode ter
            custo para a loja.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ['pesoGramas', 'Peso bruto (g)'],
                ['alturaCm', 'Altura do pacote (cm)'],
                ['larguraCm', 'Largura do pacote (cm)'],
                ['comprimentoCm', 'Comprimento do pacote (cm)'],
              ] as const
            ).map(([campo, rotulo]) => (
              <div className="space-y-1" key={campo}>
                <Label htmlFor={`ml-${campo}`}>{rotulo}</Label>
                <Input
                  id={`ml-${campo}`}
                  type="number"
                  min="0"
                  step={campo === 'pesoGramas' ? '1' : '0.1'}
                  value={value[campo] ?? ''}
                  onChange={(event) =>
                    alterar(campo, event.target.value === '' ? null : Number(event.target.value))
                  }
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Use o pacote pronto para envio. As dimensões da peça e o consumo de filamento não
            substituem essa medição.
          </p>
        </>
      )}
    </section>
  );
}
