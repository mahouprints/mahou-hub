'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIMES_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  onArquivos: (arquivos: File[]) => void;
  disabled?: boolean;
  /** Texto exibido no estado idle. Default: "Arraste imagens aqui ou clique pra selecionar". */
  label?: string;
  multiplos?: boolean;
}

/**
 * Drop zone com drag-and-drop nativo + click pra abrir picker. Sem dep externa.
 * Valida mime/tamanho client-side e descarta arquivos inválidos com warning leve.
 */
export function UploadDropzone({
  onArquivos,
  disabled,
  label = 'Arraste imagens aqui ou clique pra selecionar',
  multiplos = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function processar(lista: FileList | null) {
    if (!lista) return;
    const arquivos: File[] = [];
    const rejeitados: string[] = [];
    Array.from(lista).forEach((f) => {
      if (!MIMES_ACEITOS.includes(f.type)) {
        rejeitados.push(`${f.name} (tipo ${f.type || 'desconhecido'})`);
        return;
      }
      if (f.size > MAX_BYTES) {
        rejeitados.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB > 10MB)`);
        return;
      }
      arquivos.push(f);
    });
    if (rejeitados.length > 0) {
      setErro(`Ignorados: ${rejeitados.join(', ')}`);
    } else {
      setErro(null);
    }
    if (arquivos.length > 0) onArquivos(arquivos);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (disabled) return;
    processar(e.dataTransfer.files);
  }

  function onSelect(e: ChangeEvent<HTMLInputElement>) {
    processar(e.target.files);
    // permite re-selecionar o mesmo arquivo
    e.target.value = '';
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm transition-colors',
          disabled
            ? 'cursor-not-allowed border-border text-muted-foreground/40'
            : 'cursor-pointer text-muted-foreground hover:border-primary hover:text-foreground',
          arrastando && 'border-primary bg-primary/5 text-foreground',
        )}
      >
        <Upload className="h-5 w-5" />
        <span className="text-center">{label}</span>
        <span className="text-xs text-muted-foreground/70">
          JPG, PNG, WebP, HEIC ou AVIF · máx. 10MB cada
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={MIMES_ACEITOS.join(',')}
        multiple={multiplos}
        className="hidden"
        onChange={onSelect}
        disabled={disabled}
      />
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
