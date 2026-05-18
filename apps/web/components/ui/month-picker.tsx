'use client';

import { useMemo, useState } from 'react';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  /** 'YYYY-MM' ou '' quando nenhum mês selecionado. */
  value: string;
  onChange: (mes: string) => void;
  placeholder?: string;
  className?: string;
  /** Mostra botão de limpar (X) — útil em filtros opcionais. */
  clearable?: boolean;
  disabled?: boolean;
}

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
const MESES_LONGOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Selecionador de mês/ano com grid de 12 meses + navegação por ano.
 * value usa formato 'YYYY-MM' pra bater com input type=month nativo do HTML.
 */
export function MonthPicker({
  value,
  onChange,
  placeholder = 'Selecionar mês',
  className,
  clearable,
  disabled,
}: Props) {
  const hoje = useMemo(() => new Date(), []);
  const selecionado = parseMes(value);
  const [anoView, setAnoView] = useState(selecionado?.ano ?? hoje.getFullYear());
  const [aberto, setAberto] = useState(false);

  function selecionar(mesIdx: number) {
    onChange(formatMes(anoView, mesIdx));
    setAberto(false);
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  const label = selecionado
    ? `${MESES_LONGOS[selecionado.mes]} ${selecionado.ano}`
    : placeholder;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selecionado && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon />
          <span className="flex-1 truncate">{label}</span>
          {clearable && selecionado && (
            <span
              role="button"
              tabIndex={0}
              onClick={limpar}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') limpar(e as unknown as React.MouseEvent);
              }}
              aria-label="Limpar"
              className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAnoView((y) => y - 1)}
            aria-label="Ano anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">{anoView}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAnoView((y) => y + 1)}
            aria-label="Próximo ano"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MESES_CURTOS.map((m, i) => {
            const ativo = selecionado?.ano === anoView && selecionado?.mes === i;
            const ehMesAtual = anoView === hoje.getFullYear() && i === hoje.getMonth();
            return (
              <button
                key={m}
                type="button"
                onClick={() => selecionar(i)}
                className={cn(
                  'rounded-md py-2 text-sm transition-colors',
                  ativo
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                  !ativo && ehMesAtual && 'ring-1 ring-primary/40',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseMes(s: string): { ano: number; mes: number } | null {
  if (!s) return null;
  const partes = s.split('-').map(Number);
  const ano = partes[0];
  const mm = partes[1];
  if (ano == null || mm == null || mm < 1 || mm > 12) return null;
  return { ano, mes: mm - 1 };
}

function formatMes(ano: number, mes: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}
