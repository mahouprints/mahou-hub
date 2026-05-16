'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV = [
  { href: '/calculadora', label: 'Calculadora' },
  { href: '/produtos', label: 'Produtos' },
  { href: '/simulador', label: 'Simulador' },
  { href: '/producao', label: 'Produção' },
  { href: '/concorrentes', label: 'Concorrentes' },
  { href: '/ideias', label: 'Ideias' },
  { href: '/configuracoes', label: 'Configurações' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-56 shrink-0 border-r border-mahou-line bg-white p-4">
      <Link href="/calculadora" className="block px-2 py-3 text-lg font-semibold">
        Mahou Hub
      </Link>
      <ul className="mt-4 space-y-1">
        {NAV.map((item) => {
          const ativo = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  ativo
                    ? 'bg-mahou-accent/10 text-mahou-accent font-medium'
                    : 'text-mahou-mute hover:bg-mahou-bg',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
