import React, { type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProdutoForm } from '../components/produto-form';
import { VariacaoDialog } from '../components/variacao-dialog';
import type { ProdutoComInsumos } from '../lib/produto-form';

const estado = vi.hoisted(() => ({
  client: null as QueryClient | null,
  sucessoVariacao: null as (() => void) | null,
  apiFetch: vi.fn(),
  push: vi.fn(),
}));
vi.stubGlobal('React', React);
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (inicial: unknown) => [typeof inicial === 'function' ? inicial() : inicial, vi.fn()],
  useEffect: vi.fn(),
}));
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => estado.client,
  useQuery: () => ({ data: undefined }),
  useMutation: (opcoes: { onSuccess: () => void }) => {
    estado.sucessoVariacao = opcoes.onSuccess;
    return { mutate: vi.fn(), isPending: false };
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: estado.push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({
  apiFetch: estado.apiFetch,
  apiUrl: vi.fn(),
  fetchComRetry: vi.fn(),
}));
vi.mock('@/lib/parsing', () => import('../lib/parsing'));
vi.mock('@/lib/produto-form', () => import('../lib/produto-form'));
vi.mock('@/lib/produto-filamentos', () => import('../lib/produto-filamentos'));
// Os filhos visuais não são renderizados: capturamos os callbacks da árvore do formulário.
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('@/components/ui/input-decimal', () => ({ InputDecimal: 'input' }));
vi.mock('@/components/ui/card', () => ({
  Card: 'div',
  CardContent: 'div',
  CardDescription: 'p',
  CardHeader: 'div',
  CardTitle: 'h2',
}));
vi.mock('@/components/ui/select', () => ({
  Select: 'div',
  SelectContent: 'div',
  SelectItem: 'div',
  SelectTrigger: 'div',
  SelectValue: 'div',
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: 'div',
  DialogClose: 'div',
  DialogContent: 'div',
  DialogDescription: 'p',
  DialogFooter: 'div',
  DialogHeader: 'div',
  DialogTitle: 'h2',
}));
vi.mock('@/components/produto-mercado-livre-form', () => ({ ProdutoMercadoLivreForm: 'div' }));
vi.mock('@/components/produto-filamentos-secao', () => ({ ProdutoFilamentosSecao: 'div' }));
vi.mock('@/components/produto-preview', () => ({ ProdutoPreview: 'div' }));
vi.mock('@/components/produto-insumos-secao', () => ({ ProdutoInsumosSecao: 'div' }));
vi.mock('@/components/produto-imagens-inicial', () => ({ ProdutoImagensInicial: 'div' }));
vi.mock('@/components/imagens-section', () => ({ ImagensSection: 'div' }));

function envioDoFormulario(arvore: ReactNode): ((evento: FormEvent) => Promise<void>) | undefined {
  for (const elemento of React.Children.toArray(arvore)) {
    if (
      !React.isValidElement<{
        children?: ReactNode;
        onSubmit?: (evento: FormEvent) => Promise<void>;
      }>(elemento)
    )
      continue;
    if (elemento.type === 'form') return elemento.props.onSubmit;
    const envio = envioDoFormulario(elemento.props.children);
    if (envio) return envio;
  }
}

beforeEach(() => {
  estado.client = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  });
  estado.sucessoVariacao = null;
  estado.apiFetch.mockReset().mockResolvedValue({});
  estado.push.mockReset();
});
afterEach(() => estado.client?.clear());

describe('atualização dos custos em cache', () => {
  it('salvar o produto refaz as variações ao voltar ao detalhe, mesmo dentro dos 30 segundos', async () => {
    const produto: ProdutoComInsumos = {
      id: 'p1',
      nome: 'Dragão',
      filamentoId: 'pla',
      pesoG: 13,
      tempoH: 0.87,
      precoCentavos: 2990,
      embalagemCentavos: 40,
      impressora: 'A1',
      canalPrincipal: 'ML',
      inspiracao: null,
      modelo3dUrl: null,
      larguraCm: null,
      alturaCm: null,
      profundidadeCm: null,
      ativo: true,
      anunciado: false,
      canaisAnunciados: [],
      rascunho: false,
      metodoImagem: null,
    };
    let preco = 2290;
    const consulta = {
      queryKey: ['variacoes', 'p1'],
      queryFn: vi.fn(async () => ({
        precoEfetivoCentavos: preco,
        custosMlStatus: preco === 2290 ? 'COTADO' : 'PENDENTE',
      })),
    };
    await estado.client!.fetchQuery(consulta);
    preco = 2990;
    const envio = envioDoFormulario(ProdutoForm({ produto }));
    expect(envio).toBeDefined();
    await envio!({ preventDefault: vi.fn() } as unknown as FormEvent);
    expect(estado.apiFetch).toHaveBeenCalledWith(
      '/produtos/p1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(estado.push).toHaveBeenCalledWith('/produtos/p1');
    const observador = new QueryObserver(estado.client!, consulta);
    const parar = observador.subscribe(() => {});
    try {
      await vi.waitFor(() =>
        expect(observador.getCurrentResult().data).toEqual({
          precoEfetivoCentavos: 2990,
          custosMlStatus: 'PENDENTE',
        }),
      );
      expect(consulta.queryFn).toHaveBeenCalledTimes(2);
    } finally {
      parar();
    }
  });

  it('o sucesso ao salvar a variação invalida todos os períodos financeiros em cache', () => {
    const chaves = [
      ['financeiro-resumo', '2026-10'],
      ['financeiro-relatorio', 'MENSAL', '2026-10'],
      ['financeiro-relatorio', 'ANUAL', '2026'],
    ];
    for (const chave of chaves) estado.client!.setQueryData(chave, { lucroLiquidoCentavos: 1000 });
    VariacaoDialog({ produtoId: 'p1', produtoNome: 'Dragão', open: true, onOpenChange: vi.fn() });
    expect(estado.sucessoVariacao).not.toBeNull();
    estado.sucessoVariacao!();
    for (const chave of chaves)
      expect(estado.client!.getQueryState(chave)?.isInvalidated).toBe(true);
  });
});
