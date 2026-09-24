import type { SVGProps } from 'react';

const common: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.5,
};

export function BenefitIcon({ name }: { name: 'calendar' | 'percent' | 'user' | 'gift' | 'users' }) {
  if (name === 'calendar') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2M15 18h2" /></svg>;
  }
  if (name === 'percent') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m6 19 12-14" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></svg>;
  }
  if (name === 'user') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
  }
  if (name === 'gift') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 10h16v11H4zM2.5 6.5h19V10h-19zM12 6.5V21M12 6.5H8.5a2.5 2.5 0 1 1 2.5-2.5ZM12 6.5h3.5A2.5 2.5 0 1 0 13 4Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><circle cx="3.5" cy="9" r="2" /><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5M1 20a4 4 0 0 1 4-4" /></svg>;
}
