'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calculator,
  Boxes,
  Package,
  Warehouse,
  Receipt,
  PlayCircle,
  Factory,
  Crosshair,
  DollarSign,
  Lightbulb,
  Menu,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_PRINCIPAL = [
  { href: '/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/produtos', label: 'Produtos', icon: Boxes },
  { href: '/insumos', label: 'Insumos', icon: Package },
  { href: '/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/recibos', label: 'Recibos', icon: Receipt },
  { href: '/simulador', label: 'Simulador', icon: PlayCircle },
  { href: '/producao', label: 'Produção', icon: Factory },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/concorrentes', label: 'Concorrentes', icon: Crosshair },
  { href: '/oportunidades', label: 'Oportunidades', icon: Lightbulb },
];

const NAV_RODAPE = [{ href: '/configuracoes', label: 'Configurações', icon: Settings }];

function Logo() {
  return (
    <Link href="/calculadora" className="flex items-center gap-2">
      <Sparkles className="h-5 w-5 text-primary" />
      <span className="text-lg font-semibold tracking-tight">Mahou Hub</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  // Fecha o drawer ao navegar pra outra rota.
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  return (
    <>
      {/* Barra de topo (só mobile): logo + botão de menu. Fica fora do <main>, então não rola. */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setAberto(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Sidebar fixa (só desktop). */}
      <nav className="hidden w-60 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <div className="mb-6 px-2 py-3">
          <Logo />
        </div>
        <ListaNav pathname={pathname} />
      </nav>

      {/* Drawer deslizante (só mobile). Sempre no DOM pra animar; sem interação quando fechado. */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', !aberto && 'pointer-events-none')}>
        <button
          type="button"
          aria-label="Fechar menu"
          tabIndex={aberto ? 0 : -1}
          onClick={() => setAberto(false)}
          className={cn(
            'absolute inset-0 cursor-default bg-black/50 transition-opacity',
            aberto ? 'opacity-100' : 'opacity-0',
          )}
        />
        <nav
          className={cn(
            'absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col border-r border-border bg-card p-4 transition-transform',
            aberto ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="mb-6 flex items-center justify-between px-2 py-1">
            <Logo />
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setAberto(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ListaNav pathname={pathname} onNavegar={() => setAberto(false)} />
        </nav>
      </div>
    </>
  );
}

function ListaNav({ pathname, onNavegar }: { pathname: string; onNavegar?: () => void }) {
  return (
    <>
      <ul className="flex-1 space-y-0.5">
        {NAV_PRINCIPAL.map((item) => (
          <ItemNav key={item.href} item={item} pathname={pathname} onNavegar={onNavegar} />
        ))}
      </ul>
      <ul className="space-y-0.5 border-t border-border pt-3">
        {NAV_RODAPE.map((item) => (
          <ItemNav key={item.href} item={item} pathname={pathname} onNavegar={onNavegar} />
        ))}
      </ul>
    </>
  );
}

interface ItemNavProps {
  item: { href: string; label: string; icon: typeof Calculator };
  pathname: string;
  onNavegar?: () => void;
}

function ItemNav({ item, pathname, onNavegar }: ItemNavProps) {
  const ativo = pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavegar}
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
