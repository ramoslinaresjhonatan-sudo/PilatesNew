'use client';

import type { AuthSession } from './types';

const SESSION_KEY = 'pilates_house_session';
const SESSION_EVENT = 'pilates-house-session-change';
const BACKOFFICE_ROLES = new Set(['ADMINISTRADOR', 'RECEPCION', 'RECEPCIONISTA']);

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return Boolean(
    typeof session.token === 'string' &&
    session.token.length > 0 &&
    session.token.length <= 8192 &&
    typeof session.expiresAt === 'string' &&
    typeof session.user?.id === 'string' &&
    session.user.id.length > 0 &&
    session.user.id.length <= 80 &&
    typeof session.user?.nombre === 'string' &&
    session.user.nombre.length <= 160 &&
    typeof session.user?.correo === 'string' &&
    session.user.correo.length <= 254 &&
    Array.isArray(session.user.roles) &&
    session.user.roles.length <= 10 &&
    session.user.roles.every((role) => typeof role === 'string' && role.length <= 50) &&
    (session.user.permisos === undefined ||
      (Array.isArray(session.user.permisos) &&
        session.user.permisos.length <= 100 &&
        session.user.permisos.every((permission) => typeof permission === 'string' && permission.length <= 100))),
  );
}

export function hasBackofficeRole(session: AuthSession | null) {
  return session?.user.roles.some((role) => BACKOFFICE_ROLES.has(role)) ?? false;
}

function isBackofficePath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname === '/panel' || pathname.startsWith('/panel/') || pathname === '/usuarios';
}

export function isClient(session: AuthSession | null) {
  return session?.user.roles.includes('CLIENTE') ?? false;
}

function isClientPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname === '/mi-panel' || pathname.startsWith('/mi-panel/');
}

/**
 * Cada rol aterriza en su propio panel. Se respeta `next` solo si esa ruta le
 * corresponde: sin ese filtro, un administrador que llegaba desde
 * `/login?next=/mi-panel` terminaba viendo el panel del cliente.
 */
export function getPostLoginDestination(session: AuthSession, nextPath: string | null) {
  if (hasBackofficeRole(session)) {
    return nextPath && !isClientPath(nextPath) ? nextPath : '/panel';
  }
  if (isClient(session)) {
    return nextPath && !isBackofficePath(nextPath) ? nextPath : '/mi-panel';
  }
  /* Coach o guardia: no tienen panel propio todavia. */
  return nextPath && !isBackofficePath(nextPath) && !isClientPath(nextPath) ? nextPath : '/';
}

export function parseSessionValue(raw: string | null): AuthSession | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSession(parsed) && Date.parse(parsed.expiresAt) > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

export function getSessionSnapshot() {
  return typeof window === 'undefined' ? '' : window.sessionStorage.getItem(SESSION_KEY) || '';
}

export function getServerSessionSnapshot() {
  return '';
}

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const session = parseSessionValue(window.sessionStorage.getItem(SESSION_KEY));
  if (!session) {
    window.sessionStorage.removeItem(SESSION_KEY);
  }
  return session;
}

export function saveSession(session: AuthSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function onSessionChange(callback: () => void) {
  window.addEventListener(SESSION_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SESSION_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
