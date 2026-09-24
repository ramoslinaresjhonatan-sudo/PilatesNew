'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApiResource } from '@/hooks/use-api-resource';
import { ApiError, getErrorMessage } from '@/lib/api';
import { getActiveMembership } from '@/lib/client-api';
import type { ActiveMembership, AuthSession, ProfileResponse } from '@/lib/types';

type MembershipStatus = 'idle' | 'loading' | 'active' | 'none' | 'unavailable';

function isNoMembership(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 404 || !error.details || typeof error.details !== 'object') return false;
  const message = 'message' in error.details ? String((error.details as { message?: unknown }).message || '') : '';
  return /membres[ií]a.*activa|sin membres[ií]a/i.test(message);
}

export function useClientAccount(session: AuthSession | null, enabled = true) {
  const clientEnabled = enabled && Boolean(session?.user.roles.includes('CLIENTE'));
  const profileResource = useApiResource<ProfileResponse>(clientEnabled ? '/perfil' : null, true);
  const retryProfile = profileResource.retry;
  const profile = profileResource.data;
  const embeddedMembership = profile?.membresia_activa ?? profile?.usuario.cliente?.membresia_activa;
  const needsMembershipFallback = Boolean(profile) && embeddedMembership === undefined;
  const [fallbackMembership, setFallbackMembership] = useState<ActiveMembership | null>(null);
  const [fallbackStatus, setFallbackStatus] = useState<'idle' | 'active' | 'none' | 'unavailable'>('idle');
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [fallbackVersion, setFallbackVersion] = useState(0);

  useEffect(() => {
    if (!clientEnabled || !needsMembershipFallback) return undefined;
    let active = true;
    void getActiveMembership()
      .then((membership) => {
        if (!active) return;
        setFallbackMembership(membership);
        setFallbackStatus(membership ? 'active' : 'none');
        setFallbackError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFallbackMembership(null);
        setFallbackStatus(isNoMembership(error) ? 'none' : 'unavailable');
        setFallbackError(isNoMembership(error) ? null : getErrorMessage(error));
      });
    return () => { active = false; };
  }, [clientEnabled, fallbackVersion, needsMembershipFallback]);

  const refresh = useCallback(() => {
    retryProfile();
    setFallbackStatus('idle');
    setFallbackVersion((value) => value + 1);
  }, [retryProfile]);

  let membership: ActiveMembership | null = null;
  let membershipStatus: MembershipStatus = 'idle';
  if (clientEnabled) {
    if (profileResource.loading) membershipStatus = 'loading';
    else if (profileResource.error) membershipStatus = 'unavailable';
    else if (embeddedMembership !== undefined) {
      membership = embeddedMembership;
      membershipStatus = embeddedMembership ? 'active' : 'none';
    } else {
      membership = fallbackMembership;
      membershipStatus = fallbackStatus === 'idle' ? 'loading' : fallbackStatus;
    }
  }

  return {
    profile,
    membership,
    membershipStatus,
    loading: membershipStatus === 'loading',
    error: profileResource.error || fallbackError,
    refresh,
  };
}
