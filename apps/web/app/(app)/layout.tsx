import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
