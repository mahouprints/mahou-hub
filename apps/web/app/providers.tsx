'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
        // Toast global pra qualquer erro de query/mutation que não foi
        // explicitamente tratado com onError local (que ainda funciona normal).
        mutationCache: new MutationCache({
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro inesperado'),
        }),
        queryCache: new QueryCache({
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro inesperado'),
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
