'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Seletor de uma data específica via calendário em popover (padrão shadcn).
 * Exibe a data formatada no botão; abre o calendário ao clicar.
 */
export function DatePicker({ value, onChange, placeholder = 'Selecionar data', className, disabled }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon />
          {value ? format(value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setAberto(false);
          }}
          locale={ptBR}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
