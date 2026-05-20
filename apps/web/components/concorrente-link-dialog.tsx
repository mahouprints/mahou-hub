'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConcorrenteCreateFromLinkSchema } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ConcorrenteLinkDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [url, setUrl] = useState('');

  const criar = useMutation({
    // 1ª sync acontece síncrono dentro de POST /from-link e leva ~5-15s.
    mutationFn: (link: string) =>
      apiFetch<{ id: string }>(`/concorrentes/from-link`, {
        method: 'POST',
        json: { url: link },
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['concorrentes'] });
      toast.success('Loja adicionada e sincronizada');
      onOpenChange(false);
      setUrl('');
      router.push(`/concorrentes/${created.id}`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = ConcorrenteCreateFromLinkSchema.safeParse({ url: url.trim() });
    if (!result.success) {
      toast.error('Cole uma URL válida da Shopee (ex: shopee.com.br/3dtechimprensoes)');
      return;
    }
    criar.mutate(result.data.url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar concorrente via link Shopee</DialogTitle>
          <DialogDescription>
            Cole a URL da loja (<code>shopee.com.br/&lt;nome-da-loja&gt;</code> ou{' '}
            <code>shopee.com.br/shop/&lt;id&gt;</code>). Vou resolver o shopId e fazer a primeira
            sincronização. Demora ~10s.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="url">URL da loja</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://shopee.com.br/3dtechimprensoes"
              required
              autoFocus
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={criar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending ? 'Sincronizando…' : 'Adicionar e sincronizar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
