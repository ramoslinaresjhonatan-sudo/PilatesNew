'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage, isTransientApiError } from '@/lib/api';
import { useAuthSession } from '@/hooks/use-auth-session';

type ResourceState<T> = {
  data: T | null;
  error: string | null;
  key: string;
};

type CacheEntry = {
  data: unknown;
  updatedAt: number;
  lastAccessedAt: number;
};

export type ApiResourceCacheOptions = {
  staleTimeMs?: number;
  maxAgeMs?: number;
  refreshIntervalMs?: number;
};

const PUBLIC_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000] as const;
const AUTHENTICATED_RETRY_DELAYS_MS = [500] as const;
const MAX_CACHE_ENTRIES = 100;
const resourceCache = new Map<string, CacheEntry>();
const resourceEpochs = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const invalidationListeners = new Map<string, Set<() => void>>();
const GALLERY_REVISION_KEY = 'pilates-house:gallery-revision';

function invalidateGalleryResources() {
  const keys = new Set([...resourceCache.keys(), ...resourceEpochs.keys(), ...invalidationListeners.keys()]);
  for (const key of keys) {
    if (key.startsWith('/landing/seccion') || key.startsWith('/imagen|')) invalidateApiResource(key);
  }
}

/** Refresh public content as well as the panel, including other open tabs. */
export function invalidateGalleryContent() {
  invalidateGalleryResources();
  try {
    window.localStorage.setItem(GALLERY_REVISION_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // The current tab still refreshes when browser storage is unavailable.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === GALLERY_REVISION_KEY) invalidateGalleryResources();
  });
}

function waitForRetry(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

function defaultCachePolicy(path: string, authenticated: boolean) {
  if (authenticated) {
    if (path === '/perfil') return { staleTimeMs: 30_000, maxAgeMs: 5 * 60_000 };
    if (/^\/(pago|orden-membresia|inscripcion|membresia)(\/|\?|$)/.test(path)) return { staleTimeMs: 15_000, maxAgeMs: 2 * 60_000 };
    return { staleTimeMs: 45_000, maxAgeMs: 5 * 60_000 };
  }

  if (path.startsWith('/agenda')) return { staleTimeMs: 30_000, maxAgeMs: 2 * 60_000 };
  // Las secciones se publican y se ocultan desde el panel: conviene releerlas seguido.
  if (path.startsWith('/landing/seccion')) return { staleTimeMs: 30_000, maxAgeMs: 5 * 60_000 };
  if (path.startsWith('/imagen')) return { staleTimeMs: 10 * 60_000, maxAgeMs: 60 * 60_000 };
  if (path.startsWith('/actividad') || path.startsWith('/plan-membresia') || path.startsWith('/coach')) return { staleTimeMs: 5 * 60_000, maxAgeMs: 30 * 60_000 };
  return { staleTimeMs: 2 * 60_000, maxAgeMs: 15 * 60_000 };
}

function pruneCache() {
  if (resourceCache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...resourceCache.entries()]
    .sort((left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt)
    .slice(0, resourceCache.size - MAX_CACHE_ENTRIES);
  oldest.forEach(([key]) => resourceCache.delete(key));
}

function getCached<T>(key: string, maxAgeMs: number) {
  const entry = resourceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > maxAgeMs) {
    resourceCache.delete(key);
    return null;
  }
  entry.lastAccessedAt = Date.now();
  return entry as CacheEntry & { data: T };
}

function notifyInvalidation(key: string) {
  invalidationListeners.get(key)?.forEach((listener) => listener());
}

export function invalidateApiResource(key: string) {
  resourceCache.delete(key);
  resourceEpochs.set(key, (resourceEpochs.get(key) || 0) + 1);
  notifyInvalidation(key);
}

/**
 * Invalida todas las variantes de un mismo listado: filtros, busquedas y paginas
 * viven en claves distintas, asi que refrescar solo la vista actual dejaba a las
 * demas mostrando datos viejos despues de crear, dar de baja o reactivar.
 */
export function invalidateApiResourcesByPath(pathPrefix: string) {
  const keys = new Set<string>();
  resourceCache.forEach((_, key) => { if (key.startsWith(pathPrefix)) keys.add(key); });
  invalidationListeners.forEach((_, key) => { if (key.startsWith(pathPrefix)) keys.add(key); });
  keys.forEach((key) => {
    resourceCache.delete(key);
    resourceEpochs.set(key, (resourceEpochs.get(key) || 0) + 1);
    notifyInvalidation(key);
  });
}

export function clearApiResourceCache() {
  resourceCache.clear();
  resourceEpochs.clear();
  invalidationListeners.forEach((listeners) => listeners.forEach((listener) => listener()));
}

async function requestWithRetry<T>(path: string, authenticated: boolean) {
  const retryDelays = authenticated ? AUTHENTICATED_RETRY_DELAYS_MS : PUBLIC_RETRY_DELAYS_MS;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await apiRequest<T>(path, { authenticated });
    } catch (error: unknown) {
      const delay = retryDelays[attempt];
      if (delay !== undefined && isTransientApiError(error)) {
        await waitForRetry(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('No fue posible completar la solicitud.');
}

function sharedRequest<T>(path: string, authenticated: boolean, resourceKey: string) {
  const epoch = resourceEpochs.get(resourceKey) || 0;
  const requestKey = `${resourceKey}|${epoch}`;
  const existing = inFlightRequests.get(requestKey) as Promise<T> | undefined;
  if (existing) return existing;

  const request = requestWithRetry<T>(path, authenticated)
    .then((data) => {
      if ((resourceEpochs.get(resourceKey) || 0) === epoch) {
        const now = Date.now();
        resourceCache.set(resourceKey, { data, updatedAt: now, lastAccessedAt: now });
        pruneCache();
      }
      return data;
    })
    .finally(() => {
      if (inFlightRequests.get(requestKey) === request) inFlightRequests.delete(requestKey);
    });
  inFlightRequests.set(requestKey, request);
  return request;
}

export function useApiResource<T>(path: string | null, authenticated = false, options: ApiResourceCacheOptions = {}) {
  const session = useAuthSession();
  const [state, setState] = useState<ResourceState<T>>({ data: null, error: null, key: '' });
  const [version, setVersion] = useState(0);
  const sessionScope = authenticated ? session?.user.id || 'anonymous' : 'public';
  const resourceKey = `${path || ''}|${authenticated ? `auth:${sessionScope}` : 'public'}`;
  const canRequest = Boolean(path) && (!authenticated || Boolean(session));
  const defaults = useMemo(() => defaultCachePolicy(path || '', authenticated), [authenticated, path]);
  const staleTimeMs = options.staleTimeMs ?? defaults.staleTimeMs;
  const maxAgeMs = Math.max(staleTimeMs, options.maxAgeMs ?? defaults.maxAgeMs);
  const refreshIntervalMs = options.refreshIntervalMs ?? 0;

  const retry = useCallback(() => invalidateApiResource(resourceKey), [resourceKey]);

  useEffect(() => {
    if (!path || !canRequest || refreshIntervalMs <= 0) return;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (!active || refreshing || document.visibilityState !== 'visible' || !navigator.onLine) return;
      refreshing = true;
      const epoch = resourceEpochs.get(resourceKey) || 0;
      try {
        // Bypass cache freshness, but share concurrent requests and keep cards visible.
        const data = await sharedRequest<T>(path, authenticated, resourceKey);
        if (active && (resourceEpochs.get(resourceKey) || 0) === epoch) setState({ data, error: null, key: resourceKey });
      } catch {
        // Keep the last successful snapshot during a temporary connection failure.
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => { void refresh(); }, refreshIntervalMs);
    const resume = () => { void refresh(); };
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [authenticated, canRequest, path, refreshIntervalMs, resourceKey]);

  useEffect(() => {
    const listeners = invalidationListeners.get(resourceKey) || new Set<() => void>();
    const listener = () => setVersion((current) => current + 1);
    listeners.add(listener);
    invalidationListeners.set(resourceKey, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) invalidationListeners.delete(resourceKey);
    };
  }, [resourceKey]);

  useEffect(() => {
    if (!path || !canRequest) return undefined;
    let active = true;
    const cached = getCached<T>(resourceKey, maxAgeMs);
    const isFresh = cached && Date.now() - cached.updatedAt <= staleTimeMs;

    if (isFresh) return () => { active = false; };

    void sharedRequest<T>(path, authenticated, resourceKey)
      .then((data) => {
        if (active) setState({ data, error: null, key: resourceKey });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallback = getCached<T>(resourceKey, maxAgeMs);
        setState({ data: fallback?.data ?? null, error: fallback ? null : getErrorMessage(error), key: resourceKey });
      });

    return () => { active = false; };
  }, [authenticated, canRequest, maxAgeMs, path, resourceKey, staleTimeMs, version]);

  useEffect(() => {
    if (!path || !canRequest) return undefined;
    const revalidateIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      const cached = getCached<T>(resourceKey, maxAgeMs);
      if (!cached || Date.now() - cached.updatedAt > staleTimeMs) setVersion((current) => current + 1);
    };
    window.addEventListener('online', revalidateIfStale);
    document.addEventListener('visibilitychange', revalidateIfStale);
    return () => {
      window.removeEventListener('online', revalidateIfStale);
      document.removeEventListener('visibilitychange', revalidateIfStale);
    };
  }, [canRequest, maxAgeMs, path, resourceKey, staleTimeMs]);

  const current = state.key === resourceKey;
  const cached = path ? getCached<T>(resourceKey, maxAgeMs) : null;
  const data = cached?.data ?? (current ? state.data : null);
  return {
    data,
    error: current ? state.error : null,
    loading: canRequest && data === null && !(current && state.error),
    retry,
  };
}
