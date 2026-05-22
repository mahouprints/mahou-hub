import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    // overflow-x-auto + min-w-0: garante que a tabela rola horizontalmente DENTRO
    // do wrapper em vez de empurrar o layout. Combinar com min-w-0 nos ancestrais
    // flex (ver apps/web/app/(app)/layout.tsx).
    //
    // overflow-y-clip (não hidden): hidden criaria um scroll-container em Y e
    // quebraria o `position: sticky` do <thead> — clip só corta visualmente.
    // Sticky thead cola contra o <main overflow-y-auto> do layout.
    <div className="relative w-full min-w-0 overflow-x-auto overflow-y-clip">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    // sticky top-0: header fica fixo enquanto a tabela rola sob ele.
    // bg-background impede que linhas vazem por baixo no scroll;
    // z-20 fica acima de checkboxes e badges nas células.
    <thead
      ref={ref}
      className={cn(
        'sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))] [&_tr]:border-b',
        className,
      )}
      {...props}
    />
  ),
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-border transition-colors hover:bg-muted/40', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  ),
);
TableCell.displayName = 'TableCell';
