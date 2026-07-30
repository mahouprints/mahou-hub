'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import type { Canal } from '@mahou-hub/contracts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Os três em que a Mahou vende. SITE fica de fora: não é marketplace, é loja própria. */
export const MARKETPLACES: Array<{ canal: Canal; nome: string; cor: string }> = [
  { canal: 'SHOPEE', nome: 'Shopee', cor: 'text-orange-600' },
  { canal: 'ML', nome: 'Mercado Livre', cor: 'text-yellow-600' },
  { canal: 'TIKTOK', nome: 'TikTok Shop', cor: 'text-pink-600' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Onde já está anunciado. Vem vazio quando é a primeira vez. */
  canaisIniciais: Canal[];
  nomeProduto?: string;
  salvando?: boolean;
  onConfirmar: (canais: Canal[]) => void;
}

/**
 * Pergunta em quais marketplaces o produto está no ar.
 *
 * Usado nos dois momentos: ao marcar "já anunciei" pela primeira vez e ao editar depois,
 * quando sai num canal a mais ou o anúncio cai. Por isso desmarcar tudo é uma resposta
 * válida — significa "tirei de todos".
 */
export function CanaisAnunciadosDialog({
  open,
  onOpenChange,
  canaisIniciais,
  nomeProduto,
  salvando,
  onConfirmar,
}: Props) {
  const [escolhidos, setEscolhidos] = useState<Set<Canal>>(new Set());

  useEffect(() => {
    if (open) setEscolhidos(new Set(canaisIniciais));
  }, [open, canaisIniciais]);

  function alternar(canal: Canal) {
    const novo = new Set(escolhidos);
    if (novo.has(canal)) novo.delete(canal);
    else novo.add(canal);
    setEscolhidos(novo);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Onde está anunciado?</DialogTitle>
          <DialogDescription>
            {nomeProduto ? `${nomeProduto}. ` : ''}
            Marque os marketplaces em que o anúncio já está no ar. Dá pra voltar aqui e
            mudar quando publicar em mais um ou tirar de algum.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {MARKETPLACES.map((m) => (
            <label
              key={m.canal}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-accent"
            >
              <Checkbox checked={escolhidos.has(m.canal)} onCheckedChange={() => alternar(m.canal)} />
              <ShoppingBag className={`h-4 w-4 ${m.cor}`} />
              <span className="text-sm font-medium">{m.nome}</span>
            </label>
          ))}
        </div>

        {escolhidos.size === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem nenhum marcado, o produto volta a contar como não anunciado.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={salvando}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={() => onConfirmar([...escolhidos])} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
