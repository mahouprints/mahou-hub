'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { MakerworldBulkImportSchema, type MakerworldBulkImport } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { selecaoDoLote, type SelecaoMakerworld } from './selecao-modelos';

type Previa = { nomeArquivo: string; payload: MakerworldBulkImport };

/** Revisa um JSON do bot antes de importar. Ex.: <ImportarModelos onImportado={recarregar} />. */
export function ImportarModelos({
  onImportado,
}: {
  onImportado: (selecao: SelecaoMakerworld) => void;
}) {
  const arquivoInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [lendo, setLendo] = useState(false);
  const importar = useMutation({
    mutationFn: (payload: MakerworldBulkImport) =>
      apiFetch<{ criados: number; atualizados: number }>('/makerworld/bulk-import', {
        method: 'POST',
        json: payload,
      }),
    onSuccess: (resultado, payload) => {
      queryClient.invalidateQueries({ queryKey: ['makerworld'] });
      queryClient.invalidateQueries({ queryKey: ['makerworld-resumo'] });
      toast.success(`${resultado.criados} modelos novos; ${resultado.atualizados} atualizados.`);
      setPrevia(null);
      onImportado(selecaoDoLote(payload.modelos));
    },
  });

  async function lerArquivo(arquivo: File) {
    if (arquivo.size > 5 * 1024 * 1024) {
      toast.error('Escolha um JSON de até 5 MB, com no máximo 200 modelos.');
      return;
    }
    setLendo(true);
    try {
      const resultado = MakerworldBulkImportSchema.safeParse(JSON.parse(await arquivo.text()));
      if (!resultado.success) {
        toast.error('JSON inválido: use o arquivo de importação do bot, com 1 a 200 modelos.');
        return;
      }
      setPrevia({ nomeArquivo: arquivo.name, payload: resultado.data });
    } catch {
      toast.error('Não foi possível ler o JSON. Selecione o arquivo de importação do bot.');
    } finally {
      setLendo(false);
    }
  }

  return (
    <>
      <input
        ref={arquivoInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Arquivo de modelos MakerWorld"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = '';
          if (arquivo) void lerArquivo(arquivo);
        }}
      />
      <Button variant="outline" disabled={lendo} onClick={() => arquivoInput.current?.click()}>
        <Upload className="mr-1.5 size-4" />
        {lendo ? 'Lendo arquivo…' : 'Importar resultados'}
      </Button>

      <Dialog
        open={previa !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !importar.isPending) setPrevia(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar modelos do MakerWorld</DialogTitle>
            <DialogDescription>
              {previa?.payload.modelos.length} modelos em {previa?.nomeArquivo}. Os modelos já
              existentes terão seus dados atualizados, mantendo favoritos e descartados.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {previa?.payload.modelos.map((modelo, indice) => (
              <li key={`${modelo.externalId}-${indice}`}>
                <span className="font-medium">{modelo.titulo}</span>
                <span className="ml-2 text-muted-foreground">
                  {modelo.alertas.includes('PURGA_NAO_INFORMADA') && 'Peso publicado: '}
                  {modelo.pesoGramas} g · {Math.round(modelo.tempoHoras * 60)} min
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" disabled={importar.isPending} onClick={() => setPrevia(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!previa || importar.isPending}
              onClick={() => previa && importar.mutate(previa.payload)}
            >
              {importar.isPending ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
