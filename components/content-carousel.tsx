'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type ContentCarouselProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  itemCount: number;
  autoAdvanceMs?: number;
};

export function ContentCarousel({ ariaLabel, children, className = '', itemCount, autoAdvanceMs }: ContentCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(new Set<string>());
  const restartRef = useRef(() => {});
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setShowControls(itemCount > 1 && track.scrollWidth - track.clientWidth > 4);
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [itemCount]);

  const move = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const atStart = track.scrollLeft <= 4;
    const atEnd = track.scrollLeft >= maxScroll - 4;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

    if (direction === -1 && atStart) {
      track.scrollTo({ left: maxScroll, top: 0, behavior });
      return;
    }

    if (direction === 1 && atEnd) {
      track.scrollTo({ left: 0, top: 0, behavior });
      return;
    }

    const first = track.children[0];
    const second = track.children[1];
    if (!first || !second) return;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    track.scrollTo({ left: track.scrollLeft + direction * step, top: 0, behavior });
  }, []);

  useEffect(() => {
    if (!showControls || !autoAdvanceMs) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout>;
    const restart = () => {
      clearTimeout(timer);
      if (reducedMotion.matches || document.hidden) return;
      timer = setTimeout(() => {
        if (pausedRef.current.size === 0) move(1);
        restart();
      }, autoAdvanceMs);
    };
    restartRef.current = restart;
    const track = trackRef.current;
    track?.addEventListener('scroll', restart, { passive: true });
    document.addEventListener('visibilitychange', restart);
    reducedMotion.addEventListener('change', restart);
    restart();
    return () => {
      clearTimeout(timer);
      restartRef.current = () => {};
      track?.removeEventListener('scroll', restart);
      document.removeEventListener('visibilitychange', restart);
      reducedMotion.removeEventListener('change', restart);
    };
  }, [autoAdvanceMs, move, showControls]);

  return (
    <div
      className={`content-carousel ${className}`.trim()}
      aria-label={ariaLabel}
      role="region"
      onMouseEnter={() => { pausedRef.current.add('hover'); }}
      onMouseLeave={() => { pausedRef.current.delete('hover'); restartRef.current(); }}
      onFocusCapture={(event) => { if (event.target.matches(':focus-visible')) pausedRef.current.add('focus'); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { pausedRef.current.delete('focus'); restartRef.current(); } }}
      onTouchStart={() => { pausedRef.current.add('touch'); }}
      onTouchEnd={() => { pausedRef.current.delete('touch'); restartRef.current(); }}
      onTouchCancel={() => { pausedRef.current.delete('touch'); restartRef.current(); }}
      onClickCapture={() => restartRef.current()}
      onKeyDownCapture={() => restartRef.current()}
    >
      {showControls && (
        <button className="content-carousel__control content-carousel__control--previous" type="button" onClick={() => move(-1)} aria-label={`Ver elementos anteriores de ${ariaLabel}`}>
          <span aria-hidden="true">&#8249;</span>
        </button>
      )}
      <div className="content-carousel__track" ref={trackRef}>
        {children}
      </div>
      {showControls && (
        <button className="content-carousel__control content-carousel__control--next" type="button" onClick={() => move(1)} aria-label={`Ver elementos siguientes de ${ariaLabel}`}>
          <span aria-hidden="true">&#8250;</span>
        </button>
      )}
    </div>
  );
}
