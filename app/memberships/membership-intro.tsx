'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function MembershipIntro({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    function update() {
      frame = 0;
      if (!section) return;
      const bounds = section.getBoundingClientRect();
      const header = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
      const progress = Math.min(1, Math.max(0, (header - bounds.top) / (bounds.height * .8)));
      section.style.setProperty('--intro-opacity', String(motion.matches ? 1 : 1 - progress));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    motion.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      motion.removeEventListener('change', schedule);
    };
  }, []);

  return <section ref={sectionRef} className="membership-intro" aria-labelledby="membership-intro-title">{children}</section>;
}
