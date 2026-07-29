'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { Filamento, Insumo, ReciboItem } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  reciboId: string;
  item: ReciboItem;
  filamentosExistentes: Filamento[];
  onCadastrado: () => void;
}

/**
 * "Esse item não está no cadastro — quer cadastrar?" resolvido sem sair da revisão.
 *
 * O formulário chega preenchido com o que a nota já disse; o que a nota não tem (potência
 * da impressora, por exemplo) vem do padrão dos filamentos que já existem, e fica editável.
 */
export function CadastroRapidoItem({ reciboId, item, filamentosExistentes, onCadastrado }: Props) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(item.descricaoNota.slice(0, 60));
  const [unidade, setUnidade] = useState(item.unidade ?? 'un');
  const [custoReais, setCustoReais] = useState(custoSugerido(item));
  const [potA1, setPotA1] = useState(String(maisComum(filamentosExistentes.map((f) => f.potenciaA1W)) ?? 100));
  const [potH2c, setPotH2c] = useState(
    String(maisComum(filamentosExistentes.map((f) => f.potenciaH2cW)) ?? 120),
  );

  const cadastrar = useMutation({
    mutationFn: async () => {
      const centavos = Math.round(Number(custoReais.replace(',', '.')) * 100);
      if (!Number.isFinite(centavos) || centavos <= 0) throw new Error('Informe o custo');

      const vinculo =
        item.tipo === 'FILAMENTO'
          ? await criarFilamento({ nome, centavos, potA1: Number(potA1), potH2c: Number(potH2c) })
          : await criarInsumo({ nome, unidade, centavos });

      await apiFetch(`/recibos/${reciboId}/itens/${item.id}`, { method: 'PATCH', json: vinculo });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filamentos'] });
      qc.invalidateQueries({ queryKey: ['insumos'] });
      setAberto(false);
      onCadastrado();
      toast.success('Cadastrado e vinculado ao item');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar'),
  });

  const ehFilamento = item.tipo === 'FILAMENTO';

  if (!aberto) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          Não achei esse {ehFilamento ? 'filamento' : 'insumo'} no cadastro.
        </span>
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          <Plus className="h-3.5 w-3.5" /> Cadastrar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md bg-muted/50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{ehFilamento ? 'Custo por kg (R$)' : 'Custo unitário (R$)'}</Label>
          <Input value={custoReais} onChange={(e) => setCustoReais(e.target.value)} />
        </div>
        {!ehFilamento && (
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, m, kg" />
          </div>
        )}
        {ehFilamento && (
          <>
            <div className="space-y-1.5">
              <Label>Potência A1 (W)</Label>
              <Input value={potA1} onChange={(e) => setPotA1(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Potência H2C (W)</Label>
              <Input value={potH2c} onChange={(e) => setPotH2c(e.target.value)} />
            </div>
          </>
        )}
      </div>
      {ehFilamento && (
        <p className="text-xs text-muted-foreground">
          As potências não vêm na nota — vieram do padrão dos filamentos já cadastrados. Ajuste se
          este for diferente.
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => cadastrar.mutate()} disabled={cadastrar.isPending}>
          {cadastrar.isPending ? 'Cadastrando…' : 'Cadastrar e vincular'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

async function criarFilamento(dados: {
  nome: string;
  centavos: number;
  potA1: number;
  potH2c: number;
}) {
  const f = await apiFetch<Filamento>('/filamentos', {
    method: 'POST',
    json: {
      nome: dados.nome,
      custoKgCentavos: dados.centavos,
      potenciaA1W: dados.potA1,
      potenciaH2cW: dados.potH2c,
      observacao: null,
      ativo: true,
    },
  });
  return { filamentoId: f.id };
}

async function criarInsumo(dados: { nome: string; unidade: string; centavos: number }) {
  const i = await apiFetch<Insumo>('/insumos', {
    method: 'POST',
    json: {
      nome: dados.nome,
      unidade: dados.unidade,
      custoUnitarioCentavos: dados.centavos,
      observacao: null,
      ativo: true,
    },
  });
  return { insumoId: i.id };
}

/**
 * Custo pra sugerir no formulário. Filamento é por kg, então divide o valor da linha pelo
 * peso; sem peso lido, não sugere nada — o campo fica vazio pro Gabriel preencher.
 */
function custoSugerido(item: ReciboItem): string {
  if (item.tipo === 'FILAMENTO') {
    if (item.valorTotalCentavos == null || !item.gramasTotal) return '';
    return ((item.valorTotalCentavos / 100 / item.gramasTotal) * 1000).toFixed(2);
  }
  return item.valorUnitCentavos != null ? (item.valorUnitCentavos / 100).toFixed(2) : '';
}

/** Valor que mais se repete — usado só pra sugerir potência, nunca pra dinheiro. */
function maisComum(valores: number[]): number | undefined {
  const contagem = new Map<number, number>();
  valores.forEach((v) => contagem.set(v, (contagem.get(v) ?? 0) + 1));
  let melhor: number | undefined;
  let maior = 0;
  contagem.forEach((qtd, valor) => {
    if (qtd > maior) {
      maior = qtd;
      melhor = valor;
    }
  });
  return melhor;
}
