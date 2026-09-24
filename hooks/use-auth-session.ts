'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { getServerSessionSnapshot, getSessionSnapshot, onSessionChange, parseSessionValue } from '@/lib/auth';

const subscribeHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

export function useAuthSession() {
  const raw = useSyncExternalStore(onSessionChange, getSessionSnapshot, getServerSessionSnapshot);
  return useMemo(() => parseSessionValue(raw), [raw]);
}

export function useHydrated() {
  return useSyncExternalStore(subscribeHydration, getHydratedSnapshot, getServerHydratedSnapshot);
}
