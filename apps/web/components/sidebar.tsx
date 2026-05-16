'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calculator,
  Boxes,
  PlayCircle,
  Factory,
  Crosshair,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/produtos', label: 'Produtos', icon: Boxes },
  { href: '/simulador', label: 'Simulador', icon: PlayCircle },
  { href: '/producao', label: 'Produção', icon: Factory },
  { href: '/concorrentes', label: 'Concorrentes', icon: Crosshair },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-border bg-card p-4">
      <Link href="/calculadora" className="mb-6 flex items-center gap-2 px-2 py-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Mahou Hub</span>
      </Link>
      <ul className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const ativo = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
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
        })}
      </ul>
    </nav>
  );
}
