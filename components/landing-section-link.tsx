'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

export const LANDING_SECTION_IDS = [
  'experiencia',
  'ritual',
  'metodos',
  'horarios',
  'membresias',
  'beyond',
  'comunidad',
  'contacto',
] as const;

export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number];
export const LANDING_SECTION_ROUTES: Record<LandingSectionId, string> = {
  experiencia: '/disciplines',
  /* El recorrido vive dentro de la landing: se baja hasta el, no se navega. */
  ritual: '/',
  metodos: '/experience',
  horarios: '/schedule',
  membresias: '/memberships',
  beyond: '/beyond',
  comunidad: '/community',
  contacto: '/community#contacto',
};

const PENDING_SECTION_KEY = 'pilates_house_landing_section';
const landingSections = new Set<string>(LANDING_SECTION_IDS);

function isLandingSection(value: string | null): value is LandingSectionId {
  return Boolean(value && landingSections.has(value));
}

function cleanCurrentUrl() {
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

export function scrollToLandingSection(section: LandingSectionId) {
  const target = document.getElementById(section);
  if (!target) return false;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  cleanCurrentUrl();
  return true;
}

export function consumeLandingSectionTarget(): LandingSectionId | null {
  const pending = window.sessionStorage.getItem(PENDING_SECTION_KEY);
  window.sessionStorage.removeItem(PENDING_SECTION_KEY);
  if (isLandingSection(pending)) return pending;

  try {
    const fragment = decodeURIComponent(window.location.hash.slice(1));
    return isLandingSection(fragment) ? fragment : null;
  } catch {
    return null;
  }
}

export function queueLandingSection(section: LandingSectionId) {
  window.sessionStorage.setItem(PENDING_SECTION_KEY, section);
}

type LandingSectionLinkProps = {
  section: LandingSectionId;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaCurrent?: 'location' | 'page';
  onNavigate?: () => void;
};

export function LandingSectionLink({
  section,
  children,
  className,
  ariaLabel,
  ariaCurrent,
  onNavigate,
}: LandingSectionLinkProps) {
  const pathname = usePathname();
  const router = useRouter();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.();

    const destination = LANDING_SECTION_ROUTES[section];
    if (pathname === destination.split('#')[0] && scrollToLandingSection(section)) return;
    router.push(destination);
  }

  return (
    <Link
      href={LANDING_SECTION_ROUTES[section]}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={navigate}
    >
      {children}
    </Link>
  );
}
