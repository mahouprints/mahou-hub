'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Key } from 'lucide-react';
import type { ApiTokenOutput } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Card "Acesso por API" — gera JWT de longa duração pra uso externo (n8n,
 * scripts). O token é exibido só uma vez (não fica persistido em lugar nenhum)
 * porque o backend não rastreia tokens emitidos.
 */
export function ApiTokenCard() {
  const [ttlDias, setTtlDias] = useState('90');
  const [resultado, setResultado] = useState<ApiTokenOutput | null>(null);

  const gerar = useMutation({
    mutationFn: (ttl: number) =>
      apiFetch<ApiTokenOutput>('/auth/api-token', {
        method: 'POST',
        json: { ttlDias: ttl },
      }),
    onSuccess: (r) => {
      setResultado(r);
      toast.success('Token gerado — copie agora, não é exibido de novo');
    },
  });

  function onGerar() {
    const ttl = Number(ttlDias);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 365) {
      toast.error('TTL deve ser entre 1 e 365 dias');
      return;
    }
    gerar.mutate(ttl);
  }

  async function copiar() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.token);
    toast.success('Token copiado pra área de transferência');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Acesso por API
        </CardTitle>
        <CardDescription>
          Gere um token JWT de longa duração pra usar em fluxos externos (n8n, scripts).
          O token tem o mesmo acesso da sua conta — funciona em todos os endpoints.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ttl">Validade (dias)</Label>
            <Input
              id="ttl"
              type="number"
              min={1}
              max={365}
              value={ttlDias}
              onChange={(e) => setTtlDias(e.target.value)}
              className="w-32"
            />
          </div>
          <Button onClick={onGerar} disabled={gerar.isPending}>
            {gerar.isPending ? 'Gerando…' : 'Gerar token'}
          </Button>
        </div>

        {resultado && (
          <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Copie agora — não é exibido de novo.</p>
                <p className="text-xs text-muted-foreground">
                  Expira em{' '}
                  <strong className="text-foreground">
                    {new Date(resultado.expiraEm).toLocaleDateString('pt-BR')}
                  </strong>
                  . Pra revogar antes do tempo, rotacione o `JWT_SECRET` no servidor
                  (invalida todos os tokens — incluindo logins ativos).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={resultado.token}
                readOnly
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={copiar} title="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use como <code className="text-foreground">Authorization: Bearer &lt;token&gt;</code>{' '}
              em todas as requisições à API.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
