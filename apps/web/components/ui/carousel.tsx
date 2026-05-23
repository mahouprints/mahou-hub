'use client';

import { type HTMLAttributes, useCallback, useEffect, useState } from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmblaApi = UseEmblaCarouselType[1];
type EmblaOptions = Parameters<typeof useEmblaCarousel>[0];

interface CarouselProps extends HTMLAttributes<HTMLDivElement> {
  options?: EmblaOptions;
  showArrows?: boolean;
}

/**
 * Carrossel horizontal com scroll-snap. Setas aparecem em desktop quando há overflow.
 * Em mobile/touch, scroll nativo + swipe (embla já trata).
 *
 * Uso:
 *   <Carousel>
 *     <CarouselItem>...</CarouselItem>
 *     <CarouselItem>...</CarouselItem>
 *   </Carousel>
 */
export function Carousel({ children, className, options, showArrows = true, ...props }: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
    containScroll: 'trimSnaps',
    ...options,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback((api: EmblaApi) => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect(emblaApi);
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className={cn('relative', className)} {...props}>
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex -ml-3">{children}</div>
      </div>
      {showArrows && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 shadow-md transition-opacity hover:bg-accent disabled:opacity-30 sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 shadow-md transition-opacity hover:bg-accent disabled:opacity-30 sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

export function CarouselItem({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-w-0 shrink-0 grow-0 basis-full pl-3 sm:basis-1/2 md:basis-1/3 lg:basis-1/4', className)} {...props}>
      {children}
    </div>
  );
}
