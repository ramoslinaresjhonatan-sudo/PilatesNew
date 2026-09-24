'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Visible without JavaScript; only offscreen blocks opt into motion. */
export function LandingReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || element.getBoundingClientRect().top < window.innerHeight) return;
    element.dataset.reveal = 'pending';
    const reveal = () => { element.dataset.reveal = 'visible'; observer.disconnect(); };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reveal();
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    observer.observe(element);
    element.addEventListener('focusin', reveal);
    preference.addEventListener('change', reveal);
    return () => {
      observer.disconnect();
      element.removeEventListener('focusin', reveal);
      preference.removeEventListener('change', reveal);
      delete element.dataset.reveal;
    };
  }, []);
  return <div ref={ref} className={`landing-reveal ${className}`.trim()}>{children}</div>;
}
