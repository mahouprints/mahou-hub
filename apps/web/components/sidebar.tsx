'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calculator,
  Boxes,
  Package,
  PlayCircle,
  Factory,
  Crosshair,
  DollarSign,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_PRINCIPAL = [
  { href: '/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/produtos', label: 'Produtos', icon: Boxes },
  { href: '/insumos', label: 'Insumos', icon: Package },
  { href: '/simulador', label: 'Simulador', icon: PlayCircle },
  { href: '/producao', label: 'Produção', icon: Factory },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/concorrentes', label: 'Concorrentes', icon: Crosshair },
];

const NAV_RODAPE = [{ href: '/configuracoes', label: 'Configurações', icon: Settings }];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-border bg-card p-4">
      <Link href="/calculadora" className="mb-6 flex items-center gap-2 px-2 py-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Mahou Hub</span>
      </Link>
      <ul className="flex-1 space-y-0.5">
        {NAV_PRINCIPAL.map((item) => (
          <ItemNav key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
      <ul className="space-y-0.5 border-t border-border pt-3">
        {NAV_RODAPE.map((item) => (
          <ItemNav key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

interface ItemNavProps {
  item: { href: string; label: string; icon: typeof Calculator };
  pathname: string;
}

function ItemNav({ item, pathname }: ItemNavProps) {
  const ativo = pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          ativo
            ? 'bg-primary/15 text-primary-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    </li>
  );
}
