'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ResilientImage } from '@/components/resilient-image';
import { useApiResource } from '@/hooks/use-api-resource';
import { safeAssetUrl } from '@/lib/http-client';
import type { LandingSection } from '@/lib/types';
import { RitualImageEditor } from '../panel/ritual-image-editor';
import './scroll-discovery.css';

// Cada etiqueta ya usa su foto real (antes Heat.png y Community.png estaban
// cruzadas). Editar los textos y las rutas de cada escena en esta lista.
const scenes = [
  { label: 'Community', text: 'Un lugar para ser vos. Una comunidad para compartir el camino.', image: 'Community.png', position: '50% 50%', zoom: 1, chapter: '01 / 04' },
  { label: 'Movement', text: 'Todo empieza con un movimiento. Encontrá tu propio ritmo.', image: 'Movement.png', position: '50% 50%', zoom: 1, chapter: '02 / 04' },
  { label: 'Heat', text: 'Sube la temperatura. Compartimos el esfuerzo, multiplicamos la energía.', image: 'Heat.png', position: '50% 50%', zoom: 1, chapter: '03 / 04' },
  { label: 'Recovery', text: 'Bajá el ritmo. Recuperá tu equilibrio. Este momento es para vos.', image: 'Recovery.png', position: '50% 50%', zoom: 1, chapter: '04 / 04' },
] as const;
export function ScrollDiscovery({ preview = false }: { preview?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const content = useApiResource<LandingSection[]>('/landing/seccion/publicadas');
  const sceneImages = useMemo(() => {
    const section = (content.data || []).find((item) => item.clave === 'THE_HOUSE_RITUAL');
    return scenes.map((scene, index) => {
      const image = section?.imagenes?.find((item, position) => (item.orden ?? position) === index);
      return safeAssetUrl(image?.url, `/img/${scene.image}`, image?.id);
    });
  }, [content.data]);
  const displayScenes = useMemo(() => scenes.map((scene) => {
    const saved = (content.data || []).find((item) => item.clave === `RITUAL_${scene.label.toUpperCase()}`);
    return { ...scene, label: saved?.titulo || scene.label, text: saved?.descripcion || scene.text, chapter: (saved?.subtitulo || `THE HOUSE RITUAL · ${scene.chapter}`).replace('THE HOUSE RITUAL · ', '') };
  }), [content.data]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set<number>();
    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
    };
    const panels = Array.from(root.querySelectorAll<HTMLElement>('.discovery__scene'));
    const reveal = (panel: HTMLElement) => {
      const texts = Array.from(panel.querySelectorAll<HTMLElement>('[data-typing]'));
      if (reduced.matches) { texts.forEach(text => { text.textContent = text.dataset.typing || ''; }); return; }
      let line = 0;
      let length = 0;
      const typeNext = () => {
        const target = texts[line];
        if (!target) return;
        const value = Array.from(target.dataset.typing || '');
        target.textContent = value.slice(0, ++length).join('');
        if (length < value.length) later(typeNext, 30);
        else if (++line < texts.length) { length = 0; later(typeNext, 120); }
      };
      later(typeNext, 167);
    };
    panels.forEach(panel => panel.querySelectorAll<HTMLElement>('[data-typing]').forEach(text => { text.textContent = reduced.matches ? text.dataset.typing || '' : ''; }));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          reveal(entry.target.closest('.discovery__scene') as HTMLElement);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .5 });
    panels.forEach(panel => observer.observe(panel.querySelector('.discovery__copy') || panel));
    const showAll = () => {
      if (!reduced.matches) return;
      timers.forEach(timer => window.clearTimeout(timer));
      panels.forEach(panel => panel.querySelectorAll<HTMLElement>('[data-typing]').forEach(text => { text.textContent = text.dataset.typing || ''; }));
    };
    reduced.addEventListener('change', showAll);
    return () => { observer.disconnect(); timers.forEach(timer => window.clearTimeout(timer)); reduced.removeEventListener('change', showAll); };
  }, [displayScenes]);
  return (
    <div className="discovery" ref={rootRef} aria-label="Ritual Pilates House">
      {displayScenes.map((scene, index) => (
        <article id={'ritual-' + index} className="discovery__scene" key={scenes[index].image} aria-label={scene.label}>
          <ResilientImage src={sceneImages[index]} alt="" loading="lazy" decoding="async" style={{ objectPosition: scene.position }} />
          <div className="discovery__shade" />
          {preview && <RitualImageEditor index={index} label={scene.label} chapter={scene.chapter} description={scene.text} />}
          <div className="discovery__copy">
            <h3 aria-label={scene.label}><span className="discovery__reserve" aria-hidden="true">{scene.label}</span><span className="discovery__typed" aria-hidden="true" data-typing={scene.label}>{scene.label}</span></h3>
            <p aria-label={scene.text}><span className="discovery__reserve" aria-hidden="true">{scene.text}</span><span className="discovery__typed" aria-hidden="true" data-typing={scene.text}>{scene.text}</span></p>
          </div>
        </article>
      ))}
    </div>
  );
}
