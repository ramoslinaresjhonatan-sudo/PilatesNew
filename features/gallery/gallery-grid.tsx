'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ResilientImage } from '@/components/resilient-image';
import { StatusState } from '@/components/status-state';
import { useApiResource } from '@/hooks/use-api-resource';
import { safeAssetUrl } from '@/lib/api';
import type { ImageAsset, LandingSection } from '@/lib/types';

type Tile = ImageAsset & { src: string };
type Group = { section: LandingSection; images: Tile[]; offset: number };

/**
 * Cuantas imagenes del primer bloque se piden de entrada. Son las que entran en
 * pantalla al abrir la pagina; el resto espera a que el visitante baje.
 */
const EAGER_TILES = 3;

/** Margen con el que se anticipa la carga de un bloque antes de que se vea. */
const PRELOAD_MARGIN = '400px 0px';

function toTiles(section: LandingSection): Tile[] {
  return (section.imagenes || [])
    .map((image) => ({ ...image, src: safeAssetUrl(image.url, '', image.id) }))
    .filter((image): image is Tile => Boolean(image.src));
}

/**
 * Marca el bloque como visible cuando se acerca a la pantalla, para no crear las
 * imagenes de los bloques lejanos. Si el navegador no soporta el observador, se
 * da por visible: es preferible cargar de mas que dejar la galeria en blanco.
 */
function useNearViewport(enabled: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(!enabled);

  useEffect(() => {
    if (!enabled || near) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: PRELOAD_MARGIN });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, near]);

  return { ref, near };
}

function SectionGroup({ group, first, offset, onOpen }: {
  group: Group;
  first: boolean;
  offset: number;
  onOpen: (index: number) => void;
}) {
  /* El primer bloque no se difiere: es lo que se ve al entrar. */
  const { ref, near } = useNearViewport(!first);
  const { section, images } = group;

  return (
    <section className="gallery-group" ref={ref as React.RefObject<HTMLElement>} aria-labelledby={`gallery-group-${section.id}`}>
      <header className="gallery-group__heading">
        {section.subtitulo && <p className="gallery-group__eyebrow">{section.subtitulo}</p>}
        <h2 id={`gallery-group-${section.id}`}>{section.titulo}</h2>
        {section.descripcion && <p className="gallery-group__copy">{section.descripcion}</p>}
      </header>
      <div className="gallery-mosaic">
        {images.map((image, index) => {
          const eager = first && index < EAGER_TILES;
          if (!near) {
            return <span className="gallery-tile gallery-tile--placeholder" key={image.id} aria-hidden="true" />;
          }
          return (
            <button
              className="gallery-tile"
              key={image.id}
              type="button"
              onClick={() => onOpen(offset + index)}
              aria-label={image.texto_alt ? `Ampliar: ${image.texto_alt}` : 'Ampliar imagen'}
            >
              <ResilientImage
                src={image.src}
                alt={image.texto_alt || section.titulo}
                loading={eager ? 'eager' : 'lazy'}
                decoding={eager ? 'sync' : 'async'}
                fetchPriority={eager ? 'high' : 'low'}
              />
              <span className="gallery-tile__veil" aria-hidden="true" />
              {image.texto_alt && <span className="gallery-tile__caption"><strong>{image.texto_alt}</strong></span>}
              <span className="gallery-tile__zoom" aria-hidden="true">Ampliar</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function GalleryGrid() {
  const request = useApiResource<LandingSection[]>('/landing/seccion/publicadas');
  const groups = useMemo<Group[]>(
    () => (request.data || [])
      .filter((section) => section.estado === 'ACTIVO')
      .sort((first, second) => (first.orden ?? 0) - (second.orden ?? 0) || first.titulo.localeCompare(second.titulo, 'es'))
      .map((section) => ({ section, images: toTiles(section) }))
      .filter((group) => group.images.length > 0)
      /* El indice de arranque de cada bloque dentro de la lista completa del visor. */
      .map((group, index, todos) => ({
        ...group,
        offset: todos.slice(0, index).reduce((total, previo) => total + previo.images.length, 0),
      })),
    [request.data],
  );
  /* El visor recorre todas las imagenes de corrido, sin frenar en cada bloque. */
  const images = useMemo(() => groups.flatMap((group) => group.images), [groups]);
  const [selected, setSelected] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectedImage = selected === null ? null : images[selected] || null;

  useEffect(() => {
    if (!selectedImage) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'ArrowRight') setSelected((current) => current === null ? null : (current + 1) % images.length);
      if (event.key === 'ArrowLeft') setSelected((current) => current === null ? null : (current - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [images.length, selectedImage]);

  return (
    <section className="gallery-section" id="galeria" aria-label="Galería Pilates House">
      {request.loading && <StatusState kind="loading" title="Cargando la galería" description="Un momento, estamos buscando las imágenes publicadas." />}
      {request.error && <StatusState kind="error" title="No pudimos cargar la galería" description={request.error} actionLabel="Reintentar" onAction={request.retry} />}
      {!request.loading && !request.error && groups.length === 0 && <StatusState title="Galería vacía" description="Todavía no hay imágenes publicadas." />}

      {groups.map((group, index) => (
        <SectionGroup key={group.section.id} group={group} first={index === 0} offset={group.offset} onOpen={setSelected} />
      ))}

      {selectedImage && selected !== null && (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <button ref={closeRef} className="gallery-lightbox__close" type="button" onClick={() => setSelected(null)} aria-label="Cerrar imagen">×</button>
          <button className="gallery-lightbox__nav gallery-lightbox__nav--prev" type="button" onClick={() => setSelected((selected - 1 + images.length) % images.length)} aria-label="Imagen anterior">‹</button>
          <figure className="gallery-lightbox__figure"><ResilientImage src={selectedImage.src} alt={selectedImage.texto_alt || 'Imagen de Pilates House'} /><figcaption>{selectedImage.texto_alt && <strong>{selectedImage.texto_alt}</strong>}<small>{String(selected + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</small></figcaption></figure>
          <button className="gallery-lightbox__nav gallery-lightbox__nav--next" type="button" onClick={() => setSelected((selected + 1) % images.length)} aria-label="Imagen siguiente">›</button>
        </div>
      )}
    </section>
  );
}
