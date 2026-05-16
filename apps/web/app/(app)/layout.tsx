import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
