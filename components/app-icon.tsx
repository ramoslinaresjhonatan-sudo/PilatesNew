import type { SVGProps } from 'react';

export type IconName = 'back' | 'bell' | 'calendar' | 'certificate' | 'gallery' | 'home' | 'management' | 'membership' | 'payments' | 'people' | 'profile' | 'shield';

const iconProps: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
};

export function AppIcon({ name }: { name: IconName }) {
  if (name === 'back') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><path d="m10 5-7 7 7 7" /><path d="M4 12h16" /></svg>;
  }

  if (name === 'bell') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.2 6.5 2.2 6.5H4.3S6.5 16 6.5 10Z" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></svg>;
  }

  if (name === 'calendar') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><rect x="3.5" y="5.2" width="17" height="15" rx="3" /><path d="M8 3.3v4M16 3.3v4M3.5 10h17" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth="2.4" /></svg>;
  }

  if (name === 'certificate') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><circle cx="12" cy="9" r="5" /><path d="m8.8 13.1-1 7 4.2-2.5 4.2 2.5-1-7" /><path d="m10.2 9 1.1 1.1 2.5-2.5" /></svg>;
  }

  if (name === 'gallery') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="8.6" cy="10" r="1.6" /><path d="m3.8 17.4 4.4-4.1 3.6 3.2 3.1-3.1 4.9 4.4" /></svg>;
  }

  if (name === 'home') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><path d="m3.5 10.8 8.5-7 8.5 7" /><path d="M5.8 9.4V20h12.4V9.4M9.5 20v-6h5v6" /></svg>;
  }

  if (name === 'management') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="2" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="2" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="2" /><rect x="14" y="14" width="6.5" height="6.5" rx="2" /></svg>;
  }

  if (name === 'membership') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 9h18M7 14h4" /></svg>;
  }

  if (name === 'payments') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 9h18M7 14h4" /></svg>;
  }

  if (name === 'people') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 15c3.7-.7 6 1 6.5 5" /></svg>;
  }

  if (name === 'shield') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><path d="M12 3 20 6v5c0 5.2-3.2 8.4-8 10-4.8-1.6-8-4.8-8-10V6l8-3Z" /><path d="M9.3 12.1 11 13.8l3.8-4" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true" {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4.8 20c.7-4 3.1-6 7.2-6s6.5 2 7.2 6" /></svg>;
}
