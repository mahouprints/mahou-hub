'use client';

import { useEffect, useState } from 'react';
import { UploadDropzone } from '@/components/upload-dropzone';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Buffer de imagens selecionadas antes de criar o produto. Não envia nada —
 * só acumula File[]; o submit do form faz upload depois que tem o ID do produto.
 * Renderizada apenas em modo criar (em editar, user usa a seção do detail).
 */
export function ProdutoImagensInicial({
  arquivos,
  onArquivos,
  origem,
  onOrigemChange,
  desabilitado,
}: {
  arquivos: File[];
  onArquivos: (a: File[]) => void;
  origem: 'INSPIRACAO' | 'MODELO_3D' | 'OUTRA';
  onOrigemChange: (o: 'INSPIRACAO' | 'MODELO_3D' | 'OUTRA') => void;
  desabilitado: boolean;
}) {
  function remover(idx: number) {
    onArquivos(arquivos.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {arquivos.length > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {arquivos.length}{' '}
          {arquivos.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs">
        <span className="uppercase tracking-wide text-muted-foreground">Origem</span>
        <Select
          value={origem}
          onValueChange={(v) => onOrigemChange(v as 'INSPIRACAO' | 'MODELO_3D' | 'OUTRA')}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INSPIRACAO">Inspiração</SelectItem>
            <SelectItem value="MODELO_3D">Modelo 3D</SelectItem>
            <SelectItem value="OUTRA">Outra</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <UploadDropzone
        onArquivos={(novos) => onArquivos([...arquivos, ...novos])}
        disabled={desabilitado}
        label="Arraste, clique ou cole (Ctrl+V) pra enviar"
      />

      {arquivos.length > 0 && <PreviewArquivos arquivos={arquivos} onRemover={remover} />}
    </div>
  );
}

/**
 * Preview dos arquivos selecionados com thumb da imagem (via URL.createObjectURL).
 * Revoga as object-URLs no unmount/mudança pra não vazar memória.
 */
function PreviewArquivos({
  arquivos,
  onRemover,
}: {
  arquivos: File[];
  onRemover: (idx: number) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const novas = arquivos.map((f) => URL.createObjectURL(f));
    setUrls(novas);
    return () => novas.forEach((u) => URL.revokeObjectURL(u));
  }, [arquivos]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {arquivos.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
        >
          {urls[i] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[i]} alt={f.name} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
            <p className="truncate text-[10px] text-white">{f.name}</p>
            <p className="text-[10px] text-white/70 tabular-nums">
              {(f.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemover(i)}
            title="Remover"
            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
