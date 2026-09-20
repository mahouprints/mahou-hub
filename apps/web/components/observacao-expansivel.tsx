'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  texto: string | null | undefined;
  referencia: string;
}

/** Mostra até duas linhas sem esconder notas curtas. Ex.: <ObservacaoExpansivel texto={venda.observacao} referencia={produto.nome} />. */
export function ObservacaoExpansivel({ texto, referencia }: Props) {
  const id = useId();
  const paragrafoRef = useRef<HTMLParagraphElement>(null);
  const [expandida, setExpandida] = useState(false);
  const [excedeDuasLinhas, setExcedeDuasLinhas] = useState(false);

  useEffect(() => {
    const paragrafo = paragrafoRef.current;
    setExpandida(false);
    if (!paragrafo) return;
    let ativo = true;
    function medirObservacao() {
      if (!ativo || !paragrafo) return;
      const alturaLinha = Number.parseFloat(getComputedStyle(paragrafo).lineHeight);
      // Compara com duas linhas mesmo expandida, para manter o botão de recolher.
      setExcedeDuasLinhas(paragrafo.scrollHeight > alturaLinha * 2 + 1);
    }
    const observer = new ResizeObserver(medirObservacao);
    observer.observe(paragrafo);
    medirObservacao();
    void document.fonts.ready.then(medirObservacao);
    return () => {
      ativo = false;
      observer.disconnect();
    };
  }, [texto]);

  if (!texto?.trim()) return null;
  const Icone = expandida ? ChevronUp : ChevronDown;

  return (
    <div className="mt-1 max-w-[320px] text-xs font-normal text-muted-foreground">
      <p
        id={id}
        ref={paragrafoRef}
        className={cn(
          'whitespace-pre-wrap break-words leading-5 [overflow-wrap:anywhere]',
          !expandida && 'line-clamp-2',
        )}
      >
        {texto}
      </p>
      {excedeDuasLinhas && (
        <button
          type="button"
          aria-expanded={expandida}
          aria-controls={id}
          aria-label={`${expandida ? 'Recolher' : 'Expandir'} observação de ${referencia}`}
          onClick={() => setExpandida((anterior) => !anterior)}
          className="mt-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icone aria-hidden="true" className="size-3.5" />
          {expandida ? 'Recolher' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}
