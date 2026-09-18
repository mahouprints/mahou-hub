import { Plus, Trash2 } from 'lucide-react';
import { centavosParaReais } from '@/lib/format';
import { parseDecimalBr } from '@/lib/parsing';
import {
  custoFilamentosFormulario,
  type FilamentoFormulario,
  type FilamentoLinha,
} from '@/lib/produto-filamentos';
import { Button } from '@/components/ui/button';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  linhas: FilamentoLinha[];
  filamentos: FilamentoFormulario[];
  onChange: (linhas: FilamentoLinha[]) => void;
}

/** Consumo de material de uma peça, inclusive várias cores. Ex.: <ProdutoFilamentosSecao linhas={linhas} filamentos={lista} onChange={setLinhas} />. */
export function ProdutoFilamentosSecao({ linhas, filamentos, onChange }: Props) {
  const selecionados = new Set(linhas.map((linha) => linha.filamentoId));
  const pesoTotal =
    linhas.reduce((soma, linha) => {
      const peso = parseDecimalBr(linha.pesoGStr);
      return soma + (Number.isFinite(peso) && peso > 0 ? Math.round(peso * 100) : 0);
    }, 0) / 100;
  function alterar(indice: number, campo: Partial<FilamentoLinha>) {
    onChange(linhas.map((linha, atual) => (atual === indice ? { ...linha, ...campo } : linha)));
  }

  return (
    <section className="space-y-3" aria-label="Composição de filamentos">
      <div>
        <h3 className="text-sm font-medium">Filamentos por unidade do produto</h3>
        <p className="text-xs text-muted-foreground">
          Informe os gramas de cada material ou cor consumidos em uma peça.
        </p>
      </div>
      {linhas.map((linha, indice) => {
        const filamento = filamentos.find((item) => item.id === linha.filamentoId);
        const peso = parseDecimalBr(linha.pesoGStr);
        const custo =
          filamento && Number.isFinite(peso) && peso > 0
            ? custoFilamentosFormulario([linha], [filamento])
            : null;
        const opcoes = filamentos.filter(
          (item) => item.id === linha.filamentoId || (item.ativo && !selecionados.has(item.id)),
        );
        return (
          <div key={indice} className="space-y-1.5 rounded-md border p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor={`filamento-${indice}`}>Filamento {indice + 1}</Label>
                <Select
                  value={linha.filamentoId}
                  onValueChange={(filamentoId) => alterar(indice, { filamentoId })}
                >
                  <SelectTrigger id={`filamento-${indice}`}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                        {!item.ativo ? ' (inativo)' : ''} ·{' '}
                        {centavosParaReais(item.custoKgCentavos)}/kg
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`peso-filamento-${indice}`}>Peso (g)</Label>
                <InputDecimal
                  id={`peso-filamento-${indice}`}
                  aria-label={`Peso do filamento ${indice + 1} (g)`}
                  decimals={2}
                  value={linha.pesoGStr}
                  onChange={(pesoGStr) => alterar(indice, { pesoGStr })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={linhas.length === 1}
                aria-label={`Remover filamento ${indice + 1}`}
                onClick={() => onChange(linhas.filter((_, atual) => atual !== indice))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Custo nesta peça: {custo === null ? '—' : centavosParaReais(custo)}
            </p>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...linhas, { filamentoId: '', pesoGStr: '' }])}
      >
        <Plus className="size-4" /> Adicionar filamento
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>
          Peso total por unidade:{' '}
          <strong>{pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g</strong>
        </span>
        <span>
          Custo dos filamentos:{' '}
          <strong>{centavosParaReais(custoFilamentosFormulario(linhas, filamentos))}</strong>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        O primeiro filamento é a referência de potência. A energia é calculada uma vez pelo tempo
        total da peça. O custo dos materiais é somado antes de arredondar para centavos.
      </p>
    </section>
  );
}
