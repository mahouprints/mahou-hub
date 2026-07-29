'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import type {
  Filamento,
  Insumo,
  ReciboItem,
  ReciboItemTipo,
  ReciboItemUpdate,
} from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CadastroRapidoItem } from '@/components/cadastro-rapido-item';

const TIPOS: Array<{ value: ReciboItemTipo; label: string }> = [
  { value: 'FILAMENTO', label: 'Filamento (entra no estoque)' },
  { value: 'INSUMO', label: 'Insumo (entra no estoque)' },
  { value: 'NAO_ESTOCAVEL', label: 'Não-estocável (vira custo)' },
];

const CATEGORIAS = ['SOFTWARE', 'MARKETING', 'INSUMOS', 'IMPOSTOS', 'OUTROS'] as const;

/** Campo técnico → como aparece pro Gabriel no aviso de ilegível. */
const NOME_AMIGAVEL: Record<string, string> = {
  descricaoNota: 'descrição',
  quantidade: 'quantidade',
  unidade: 'unidade',
  valorUnitario: 'valor unitário',
  valorTotal: 'valor',
  tipo: 'classificação',
  gramasTotal: 'peso em gramas',
};

interface Props {
  reciboId: string;
  item: ReciboItem;
  filamentos: Filamento[];
  insumos: Insumo[];
  bloqueado: boolean;
  onMudou: () => void;
}

export function RevisaoItemLinha({ reciboId, item, filamentos, insumos, bloqueado, onMudou }: Props) {
  const salvar = useMutation({
    mutationFn: (data: ReciboItemUpdate) =>
      apiFetch(`/recibos/${reciboId}/itens/${item.id}`, { method: 'PATCH', json: data }),
    onSuccess: onMudou,
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar item'),
  });

  const estocavel = item.tipo === 'FILAMENTO' || item.tipo === 'INSUMO';
  const semVinculo = estocavel && !item.filamentoId && !item.insumoId;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.descricaoNota}</p>
          <p className="text-xs text-muted-foreground">
            {item.quantidade ?? '?'} {item.unidade ?? ''}
            {item.valorTotalCentavos != null && ` · ${centavosParaReais(item.valorTotalCentavos)}`}
          </p>
        </div>
        {item.movimentoRegistrado && <Badge variant="default">lançado</Badge>}
      </div>

      {item.camposIlegiveis.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Não foi possível ler:{' '}
          {item.camposIlegiveis.map((c) => NOME_AMIGAVEL[c] ?? c).join(', ')} — preencha abaixo
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Classificação</Label>
          <Select
            value={item.tipo ?? ''}
            onValueChange={(v) => salvar.mutate({ tipo: v as ReciboItemTipo })}
            disabled={bloqueado || item.movimentoRegistrado}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha…" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {item.tipo === 'FILAMENTO' && (
          <VinculoSelect
            rotulo="Filamento no estoque"
            valor={item.filamentoId}
            opcoes={filamentos.map((f) => ({ id: f.id, nome: f.nome }))}
            desabilitado={bloqueado || item.movimentoRegistrado}
            onEscolher={(id) => salvar.mutate({ filamentoId: id })}
          />
        )}

        {item.tipo === 'INSUMO' && (
          <VinculoSelect
            rotulo="Insumo no estoque"
            valor={item.insumoId}
            opcoes={insumos.map((i) => ({ id: i.id, nome: i.nome }))}
            desabilitado={bloqueado || item.movimentoRegistrado}
            onEscolher={(id) => salvar.mutate({ insumoId: id })}
          />
        )}

        {item.tipo === 'NAO_ESTOCAVEL' && (
          <div className="space-y-1.5">
            <Label>Categoria do custo</Label>
            <Select
              value={item.categoriaCusto ?? 'OUTROS'}
              onValueChange={(v) =>
                salvar.mutate({ categoriaCusto: v as ReciboItemUpdate['categoriaCusto'] })
              }
              disabled={bloqueado || item.movimentoRegistrado}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {item.tipo === 'FILAMENTO' && (
          <CampoNumero
            rotulo="Peso total (gramas)"
            valor={item.gramasTotal}
            desabilitado={bloqueado || item.movimentoRegistrado}
            aviso={item.gramasTotal == null ? 'a nota não disse o peso' : undefined}
            onSalvar={(n) => salvar.mutate({ gramasTotal: n })}
          />
        )}

        {item.tipo === 'INSUMO' && (
          <CampoNumero
            rotulo={`Quantidade${item.unidade ? ` (${item.unidade})` : ''}`}
            valor={item.quantidade}
            desabilitado={bloqueado || item.movimentoRegistrado}
            onSalvar={(n) => salvar.mutate({ quantidade: n })}
          />
        )}
      </div>

      {semVinculo && !bloqueado && !item.movimentoRegistrado && (
        <CadastroRapidoItem
          reciboId={reciboId}
          item={item}
          onCadastrado={onMudou}
          filamentosExistentes={filamentos}
        />
      )}
    </div>
  );
}

function VinculoSelect({
  rotulo,
  valor,
  opcoes,
  desabilitado,
  onEscolher,
}: {
  rotulo: string;
  valor: string | null;
  opcoes: Array<{ id: string; nome: string }>;
  desabilitado: boolean;
  onEscolher: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{rotulo}</Label>
      <Select value={valor ?? ''} onValueChange={onEscolher} disabled={desabilitado}>
        <SelectTrigger>
          <SelectValue placeholder="Não encontrei no cadastro" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Salva no blur pra não disparar uma requisição por tecla digitada. */
function CampoNumero({
  rotulo,
  valor,
  desabilitado,
  aviso,
  onSalvar,
}: {
  rotulo: string;
  valor: number | null;
  desabilitado: boolean;
  aviso?: string;
  onSalvar: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{rotulo}</Label>
      <Input
        type="number"
        defaultValue={valor ?? ''}
        disabled={desabilitado}
        placeholder={aviso}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0 && n !== valor) onSalvar(n);
        }}
      />
      {aviso && valor == null && <p className="text-xs text-amber-600">{aviso}</p>}
    </div>
  );
}
