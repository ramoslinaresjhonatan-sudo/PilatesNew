'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/app-icon';
import { Brand } from '@/components/brand';
import { useAuthSession } from '@/hooks/use-auth-session';
import { apiRequest } from '@/lib/api';
import { clearSession, getPostLoginDestination, hasBackofficeRole } from '@/lib/auth';
import {
  consumeLandingSectionTarget,
  LANDING_SECTION_ROUTES,
  scrollToLandingSection,
  type LandingSectionId,
} from './landing-section-link';

const NAV_ITEMS = [
  { label: 'DISCIPLINES', section: 'experiencia' },
  { label: 'THE EXPERIENCE', section: 'metodos' },
  { label: 'BEYOND', section: 'beyond' },
  { label: 'SCHEDULE', section: 'horarios' },
  { label: 'MEMBERSHIPS', section: 'membresias' },
  { label: 'COMMUNITY', section: 'comunidad' },
] satisfies ReadonlyArray<{ label: string; section: LandingSectionId }>;

type SiteHeaderProps = {
  variant?: 'hero' | 'solid';
  floatingBrand?: boolean;
  compact?: boolean;
};

export function SiteHeader({ variant = 'hero', floatingBrand = false, compact = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const session = useAuthSession();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const overImage = isHome && variant === 'hero' && !scrolled && !open;

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 48);
    const frame = requestAnimationFrame(update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); };
  }, [pathname]);
  const isBackoffice = hasBackofficeRole(session);
  const isClient = Boolean(session?.user.roles.includes('CLIENTE') && !isBackoffice);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!isHome) return;
    const requestedSection = consumeLandingSectionTarget();
    if (!requestedSection) return;

    const frame = window.requestAnimationFrame(() => {
      if (!scrollToLandingSection(requestedSection)) router.push(LANDING_SECTION_ROUTES[requestedSection]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isHome, router]);

  useEffect(() => {
    if (!isHome) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('pago') !== 'confirmado') return;
    url.searchParams.delete('pago');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [isHome]);

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST', authenticated: true });
    } catch {
      // El cierre local no depende de que el backend esté disponible.
    } finally {
      clearSession();
      setOpen(false);
      router.push('/');
    }
  }

  const unauthenticatedControl = isHome ? (
    <Link className="landing-header__login" href="/login" aria-label="Iniciar sesión" onClick={() => setOpen(false)}><span>INICIAR SESIÓN</span></Link>
  ) : (
    <Link className="landing-header__profile" href="/login" aria-label="Ingresar al perfil" onClick={() => setOpen(false)}><AppIcon name="profile" /><span>INGRESAR</span></Link>
  );

  const panelPath = session ? getPostLoginDestination(session, null) : '/login';
  const profileControl = session ? (
    <Link className="landing-header__profile" href={panelPath === '/' ? '/sin-autorizacion' : panelPath} aria-label="Ir a mi panel" onClick={() => setOpen(false)}><AppIcon name="profile" /><span>MI PANEL</span></Link>
  ) : unauthenticatedControl;

  return (
    <header data-over-image={overImage} className={`landing-header landing-header--${variant}${floatingBrand ? ' landing-header--floating-brand' : ''}${compact ? ' landing-header--compact' : ''}${open ? ' landing-header--menu-open' : ''}`}>
      <Link className="landing-header__brand" href="/" aria-label="Pilates House, inicio" onClick={() => setOpen(false)}>
        <Brand light={overImage} />
      </Link>

      {!compact && <button
        className="landing-header__menu-button"
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-controls="landing-navigation"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span /><span /><span />
      </button>}

      {!compact && <nav
        id="landing-navigation"
        className={`landing-header__nav${open ? ' landing-header__nav--open' : ''}`}
        aria-label="Navegación principal"
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={LANDING_SECTION_ROUTES[item.section]}
            className={`landing-header__link${pathname === LANDING_SECTION_ROUTES[item.section] ? ' landing-header__link--active' : ''}`}
            aria-current={pathname === LANDING_SECTION_ROUTES[item.section] ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}

        <Link className="landing-header__reserve" href={isClient ? '/mi-panel/Clases' : isBackoffice ? '/panel' : '/login?next=%2Fmi-panel'} onClick={() => setOpen(false)}>RESERVAR</Link>
        {profileControl}
        {session && !isClient && <button className="landing-header__logout" type="button" onClick={logout}>SALIR</button>}
      </nav>}
      {compact && <div className="landing-header__compact-actions">{profileControl}{session && !isClient && <button className="landing-header__logout" type="button" onClick={logout}>SALIR</button>}</div>}
    </header>
  );
}
