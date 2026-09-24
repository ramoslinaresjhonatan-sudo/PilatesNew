'use client';

import { useEffect, useState } from 'react';

export function useRotatingIndex(itemCount: number, intervalMs = 6_000) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (itemCount <= 1) {
      const reset = window.setTimeout(() => setIndex(0), 0);
      return () => window.clearTimeout(reset);
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return undefined;

    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % itemCount);
    }, Math.max(3_000, intervalMs));

    return () => window.clearInterval(timer);
  }, [intervalMs, itemCount]);

  return itemCount > 0 ? index % itemCount : 0;
}
