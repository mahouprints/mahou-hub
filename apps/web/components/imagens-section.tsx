'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { OrigemImagem, ProdutoImagem } from '@mahou-hub/contracts';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UploadDropzone } from '@/components/upload-dropzone';
import { apiUrl, fetchComRetry } from '@/lib/api-client';

const ORIGEM_LABEL: Record<OrigemImagem, string> = {
  INSPIRACAO: 'Inspiração',
  MODELO_3D: 'Modelo 3D',
  GERADA: 'Gerada',
  OUTRA: 'Outra',
};

interface Props {
  produtoId: string;
  imagens: ProdutoImagem[];
}

export function ImagensSection({ produtoId, imagens }: Props) {
  const qc = useQueryClient();
  const [origemPadrao, setOrigemPadrao] = useState<OrigemImagem>('INSPIRACAO');

  const upload = useMutation({
    mutationFn: async (arquivos: File[]) => {
      const fd = new FormData();
      arquivos.forEach((a) => fd.append('arquivos', a));
      // FormData nativo do fetch — não passamos pelo apiFetch pra evitar
      // que adicione Content-Type errado (multipart precisa do boundary auto).
      // fetchComRetry cobre blips de rede transitórios sem expor erro pro user.
      const res = await fetchComRetry(
        apiUrl(`/produtos/${produtoId}/imagens?origem=${origemPadrao}`),
        { method: 'POST', body: fd, credentials: 'include' },
      );
      if (!res.ok) {
        const corpo = await res.text();
        throw new Error(extrairMensagem(corpo) || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produto', produtoId] });
      qc.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Imagens enviadas');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao enviar'),
  });

  const remover = useMutation({
    mutationFn: async (imagemId: string) => {
      const res = await fetch(apiUrl(`/produtos/${produtoId}/imagens/${imagemId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao remover');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produto', produtoId] });
      qc.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Imagem removida');
    },
  });

  return (
    <div className="space-y-5">
      {imagens.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {imagens.map((img) => (
            <ImagemThumb
              key={img.id}
              imagem={img}
              onRemover={() => remover.mutate(img.id)}
              removendo={remover.isPending}
            />
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="uppercase tracking-wide text-muted-foreground">Origem</span>
          <Select value={origemPadrao} onValueChange={(v) => setOrigemPadrao(v as OrigemImagem)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INSPIRACAO">{ORIGEM_LABEL.INSPIRACAO}</SelectItem>
              <SelectItem value="MODELO_3D">{ORIGEM_LABEL.MODELO_3D}</SelectItem>
              <SelectItem value="OUTRA">{ORIGEM_LABEL.OUTRA}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <UploadDropzone
          onArquivos={(arquivos) => upload.mutate(arquivos)}
          disabled={upload.isPending}
          label={upload.isPending ? 'Enviando…' : 'Arraste imagens aqui ou clique pra selecionar'}
        />
      </div>
    </div>
  );
}

function ImagemThumb({
  imagem,
  onRemover,
  removendo,
}: {
  imagem: ProdutoImagem;
  onRemover: () => void;
  removendo: boolean;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagem.url}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <Badge variant="default" className="absolute left-2 top-2 text-[10px]">
        {ORIGEM_LABEL[imagem.origem]}
      </Badge>
      <button
        type="button"
        onClick={onRemover}
        disabled={removendo}
        title="Remover imagem"
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function extrairMensagem(texto: string): string {
  try {
    const obj = JSON.parse(texto) as { message?: string | string[] };
    if (Array.isArray(obj.message)) return obj.message.join(' · ');
    if (typeof obj.message === 'string') return obj.message;
  } catch {
    /* texto cru */
  }
  return texto;
}
