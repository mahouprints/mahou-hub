'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Destino do redirect OAuth do Mercado Livre.
 *
 * Existe porque a raiz do Hub redireciona pra /calculadora e o Next descarta a query
 * no caminho — o `code` chegava e sumia antes de alguém ler. Esta rota é estática e
 * não redireciona, então o parâmetro sobrevive.
 *
 * Fica fora da área autenticada de propósito: quem volta do ML pode não ter sessão
 * ativa no Hub, e mandar pro login aqui perderia o code de novo.
 */
export default function CallbackMercadoLivre() {
  return (
    <Suspense>
      <ConteudoCallback />
    </Suspense>
  );
}

function ConteudoCallback() {
  const params = useSearchParams();
  const code = params.get('code');
  const erro = params.get('error');
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Autorização do Mercado Livre</CardTitle>
          </div>
          <CardDescription>
            {code
              ? 'Autorização concedida. Copie o código abaixo e use para gerar os tokens.'
              : 'Nenhum código recebido nesta URL.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {erro && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              O Mercado Livre recusou a autorização: <strong>{erro}</strong>
            </p>
          )}

          {code && (
            <>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="mb-1 text-xs uppercase text-muted-foreground">Código de autorização</p>
                <code className="block break-all font-mono text-sm">{code}</code>
              </div>
              <Button onClick={copiar} className="w-full">
                {copiado ? (
                  <>
                    <Check className="mr-2 size-4" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 size-4" /> Copiar código
                  </>
                )}
              </Button>
              {/* O code do ML expira em poucos minutos e é de uso único — avisar evita
                  a confusão de tentar reusar um code velho e receber "invalid_grant". */}
              <p className="text-xs text-muted-foreground">
                Este código expira em poucos minutos e só pode ser usado uma vez. Se demorar,
                refaça a autorização para gerar outro.
              </p>
            </>
          )}

          {!code && !erro && (
            <p className="text-sm text-muted-foreground">
              Abra a URL de autorização do Mercado Livre. Ao aprovar, você volta para cá com o
              código preenchido.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
