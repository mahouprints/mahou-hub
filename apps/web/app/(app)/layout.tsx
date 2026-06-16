import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    // Coluna no mobile (top bar em cima, conteúdo embaixo); linha no desktop (sidebar + conteúdo).
    <div className="flex h-screen flex-col overflow-hidden lg:flex-row">
      <Sidebar />
      {/*
        min-w-0 é essencial: <main> é flex item com flex-1 e por padrão
        flex items têm min-width:auto (= largura intrínseca do conteúdo).
        Sem isso, uma tabela larga empurra o main além da viewport, causando
        scroll horizontal no body. min-w-0 força o main a respeitar o flex
        alocado, daí o overflow da tabela funciona corretamente isolado.
      */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
