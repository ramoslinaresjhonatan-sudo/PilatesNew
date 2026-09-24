'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/app-icon';
import { usePanelProfile } from '@/components/panel-profile-context';
import { StatusState } from '@/components/status-state';
import { useAuthSession } from '@/hooks/use-auth-session';
import { canAccessManagementModule, MANAGEMENT_MODULES } from '@/lib/catalog';

const priority = ['inscripciones', 'clientes', 'agenda', 'pagos', 'membresias'];

export function ReceptionDashboard() {
  const profile = usePanelProfile();
  const session = useAuthSession();
  const roles = profile.data?.roles || session?.user.roles || [];
  const permissions = profile.data?.permisos || session?.user.permisos || [];
  const modules = MANAGEMENT_MODULES.filter((module) => canAccessManagementModule(module, roles, permissions));
  const shortcuts = [...modules].sort((a, b) => {
    const rank = (slug: string) => priority.includes(slug) ? priority.indexOf(slug) : priority.length;
    return rank(a.slug) - rank(b.slug);
  });
  const firstName = (profile.data?.usuario.nombre || session?.user.nombre || '').trim().split(/\s+/)[0];

  return (
    <section className="panel-page panel-module--open client-panel">
      <header className="client-section-heading">
        <h1>Hola{firstName ? `, ${firstName}` : ''}</h1>
      </header>
      {profile.error && <StatusState kind="error" title="No pudimos actualizar tus accesos" description={profile.error} actionLabel="Reintentar" onAction={profile.retry} />}
      {shortcuts.length > 0 ? (
        <nav className="client-home-menu" aria-label="Tu recepción">
          {shortcuts.map((module) => (
            <Link key={module.slug} href={`/panel/modulos/${module.slug}`}>
              <AppIcon name={module.icon} /><strong>{module.title}</strong><span aria-hidden="true">›</span>
            </Link>
          ))}
        </nav>
      ) : <StatusState kind="info" title="Sin módulos asignados" description="El administrador todavía no asignó herramientas a tu rol." />}
    </section>
  );
}
