import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Mahou Hub',
  description: 'Hub de gerenciamento da Mahou Prints',
};

// Escala correta no celular (largura do device, sem zoom inicial).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-right" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
