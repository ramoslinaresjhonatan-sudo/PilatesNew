'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthSession, useHydrated } from '@/hooks/use-auth-session';
import { hasBackofficeRole, isClient } from '@/lib/auth';
import { StatusState } from './status-state';

export function AuthGuard({ children, backofficeOnly = false, clientOnly = false, unauthorizedPath = '/sin-autorizacion' }: { children: React.ReactNode; backofficeOnly?: boolean; clientOnly?: boolean; unauthorizedPath?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthSession();
  const hydrated = useHydrated();
  /*
   * Cada panel es de su rol: el de administracion no se le muestra al cliente y
   * el del cliente no se le muestra a quien trabaja en el estudio. A quien entra
   * donde no corresponde se lo manda a su propio panel, no a un error.
   */
  const backoffice = hasBackofficeRole(session);
  const cliente = isClient(session);
  const denied = Boolean(session && ((backofficeOnly && !backoffice) || (clientOnly && !cliente)));
  const redirectTo = backoffice ? '/panel' : cliente ? '/mi-panel' : unauthorizedPath;

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (denied) {
      router.replace(redirectTo);
    }
  }, [denied, hydrated, pathname, redirectTo, router, session]);

  if (!hydrated || !session || denied) {
    return <div className="guard-state"><StatusState kind="loading" title="Verificando tu sesión" description="Un momento, estamos preparando tu espacio." /></div>;
  }

  return <>{children}</>;
}
