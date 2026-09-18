import { Trash2 } from 'lucide-react';
import type { InsumoLinha, InsumoFormulario } from '@/lib/produto-form';
import { centavosParaReais } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputDecimal } from '@/components/ui/input-decimal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ProdutoInsumosSecao({
  linhas,
  onChange,
  insumosDisponiveis,
  subtotalCentavos,
}: {
  linhas: InsumoLinha[];
  onChange: (l: InsumoLinha[]) => void;
  insumosDisponiveis: InsumoFormulario[];
  subtotalCentavos: number;
}) {
  function adicionar() {
    onChange([...linhas, { insumoId: '', qtdStr: '' }]);
  }
  function remover(idx: number) {
    onChange(linhas.filter((_, i) => i !== idx));
  }
  function alterar(idx: number, patch: Partial<InsumoLinha>) {
    onChange(linhas.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // Insumos já escolhidos em outras linhas (pra esconder das opções)
  const idsEmUso = new Set(linhas.map((l) => l.insumoId).filter(Boolean));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Insumos por unidade do produto</Label>
        {subtotalCentavos > 0 && (
          <span className="text-xs text-muted-foreground">
            subtotal{' '}
            <span className="font-medium text-foreground tabular-nums">
              {centavosParaReais(subtotalCentavos)}
            </span>
          </span>
        )}
      </div>

      {linhas.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Adicione acrílico, caixa, fita e outros materiais consumidos em uma unidade do produto.
        </p>
      )}

      {linhas.map((linha, idx) => {
        const insumo = insumosDisponiveis.find((i) => i.id === linha.insumoId);
        const opcoes = insumosDisponiveis.filter(
          (i) => i.id === linha.insumoId || !idsEmUso.has(i.id),
        );
        return (
          <div key={idx} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
            <Select value={linha.insumoId} onValueChange={(v) => alterar(idx, { insumoId: v })}>
              <SelectTrigger aria-label={`Insumo ${idx + 1}`}>
                <SelectValue placeholder="— selecione um insumo —" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} ({centavosParaReais(i.custoUnitarioCentavos)}/{i.unidade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InputDecimal
              aria-label={`Quantidade do insumo ${idx + 1} por unidade`}
              value={linha.qtdStr}
              onChange={(s) => alterar(idx, { qtdStr: s })}
              decimals={3}
              placeholder={insumo ? `qtd em ${insumo.unidade}` : 'qtd'}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remover(idx)}
              title="Remover linha"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        + Adicionar insumo
      </Button>
    </div>
  );
}
