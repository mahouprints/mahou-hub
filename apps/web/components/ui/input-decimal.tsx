'use client';

import { forwardRef, useState, useEffect, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { parseDecimalBr } from '@/lib/parsing';

interface InputDecimalProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor atual em string (como aparece pro usuário). Aceita "35,00" ou "35.00". */
  value: string;
  onChange: (rawString: string, numero: number) => void;
  /** Quantidade de casas decimais permitidas. Default 2. */
  decimals?: number;
}

/**
 * Input que aceita formato brasileiro com vírgula como separador decimal,
 * mas também aceita ponto. Internamente normaliza pelo parseDecimalBr.
 *
 * @example <InputDecimal value={precoStr} onChange={(s, n) => setPreco(s)} />
 */
export const InputDecimal = forwardRef<HTMLInputElement, InputDecimalProps>(
  ({ className, value, onChange, decimals = 2, ...props }, ref) => {
    const [local, setLocal] = useState(value);
    useEffect(() => setLocal(value), [value]);

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={local}
        onChange={(e) => {
          const filtrado = e.target.value.replace(/[^0-9.,-]/g, '');
          setLocal(filtrado);
          onChange(filtrado, parseDecimalBr(filtrado));
        }}
        onBlur={(e) => {
          const n = parseDecimalBr(local);
          if (!Number.isNaN(n)) {
            const fixo = n.toFixed(decimals).replace('.', ',');
            setLocal(fixo);
            onChange(fixo, n);
          }
          props.onBlur?.(e);
        }}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 tabular-nums',
          className,
        )}
        {...props}
      />
    );
  },
);
InputDecimal.displayName = 'InputDecimal';
