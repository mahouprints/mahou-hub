'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIMES_IMG_PADRAO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'];
const MAX_BYTES = 100 * 1024 * 1024;

interface Props {
  onArquivos: (arquivos: File[]) => void;
  disabled?: boolean;
  /** Texto exibido no estado idle. Default: "Arraste, clique ou cole (Ctrl+V) pra enviar". */
  label?: string;
  multiplos?: boolean;
  /** Mime types aceitos. Default: imagens. Recibos passam imagens + application/pdf. */
  mimes?: string[];
  /** Subtítulo descritivo. Default fala de imagens. */
  descricao?: string;
}

/**
 * Drop zone com drag-and-drop nativo + click pra abrir picker + paste global
 * (Ctrl+V/Cmd+V em qualquer lugar da página enquanto o componente está montado).
 * Sem dep externa. Valida mime/tamanho client-side e descarta inválidos com warning leve.
 */
export function UploadDropzone({
  onArquivos,
  disabled,
  label = 'Arraste, clique ou cole (Ctrl+V) pra enviar',
  multiplos = true,
  mimes = MIMES_IMG_PADRAO,
  descricao = 'JPG, PNG, WebP, HEIC ou AVIF · máx. 100MB cada',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function processar(lista: FileList | null) {
    if (!lista) return;
    const arquivos: File[] = [];
    const rejeitados: string[] = [];
    Array.from(lista).forEach((f) => {
      if (!mimes.includes(f.type)) {
        rejeitados.push(`${f.name} (tipo ${f.type || 'desconhecido'})`);
        return;
      }
      if (f.size > MAX_BYTES) {
        rejeitados.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB > 100MB)`);
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

  // Paste global: enquanto o dropzone está montado, Ctrl+V em qualquer lugar
  // da página captura imagens do clipboard. NÃO atrapalha paste de texto em
  // inputs — clipboard items só são tratados quando kind==='file' + type=image/*.
  useEffect(() => {
    if (disabled) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const arquivos: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) arquivos.push(f);
        }
      }
      if (arquivos.length === 0) return; // não era imagem, deixa o paste seguir
      e.preventDefault();
      const dt = new DataTransfer();
      arquivos.forEach((f) => dt.items.add(f));
      processar(dt.files);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled, onArquivos]);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (disabled) return;
    processar(e.dataTransfer.files);
  }

  function onSelect(e: ChangeEvent<HTMLInputElement>) {
    processar(e.target.files);
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
        <span className="text-xs text-muted-foreground/70">{descricao}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={mimes.join(',')}
        multiple={multiplos}
        className="hidden"
        onChange={onSelect}
        disabled={disabled}
      />
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
