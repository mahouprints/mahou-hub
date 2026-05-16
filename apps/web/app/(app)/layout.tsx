import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
