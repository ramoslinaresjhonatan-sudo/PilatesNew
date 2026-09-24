'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePanelProfile } from '@/components/panel-profile-context';
import { StatusState } from '@/components/status-state';
import { useAuthSession } from '@/hooks/use-auth-session';
import { canAccessManagementModule, MANAGEMENT_MODULES } from '@/lib/catalog';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { ReceptionDashboard } from './reception-dashboard';
import { DashboardCalendar } from './dashboard-calendar';

const MODULE_IMAGES: Record<string, string> = {
  eventos: '/assets/Modulos/image.png',
  clientes: '/assets/Modulos/image5.png',
  membresias: '/assets/Modulos/image1.png',
  pagos: '/assets/Modulos/image10.png',
  disciplinas: '/assets/Modulos/image9.png',
  agenda: '/assets/Modulos/image2.png',
  inscripciones: '/assets/Modulos/image7.png',
  personal: '/assets/Modulos/image6.png',
  galeria: '/assets/Modulos/image4.png',
  certificaciones: '/assets/Modulos/image3.png',
  roles: '/assets/Modulos/image8.png',
};

export function DashboardView() {
  const profile = usePanelProfile();
  const session = useAuthSession();
  const roles = profile.data?.roles || session?.user.roles || [];
  if (!roles.includes('ADMINISTRADOR') && roles.some((role) => ['RECEPCION', 'RECEPCIONISTA'].includes(role))) {
    return <ReceptionDashboard />;
  }
  return <ManagementDashboard />;
}

function ManagementDashboard() {
  const profile = usePanelProfile();
  const session = useAuthSession();
  const roles = profile.data?.roles || session?.user.roles || [];
  const permissions = profile.data?.permisos || session?.user.permisos || [];
  const canReadClients = Boolean(
    roles.includes('ADMINISTRADOR') ||
    permissions.some((permission) => ['clients.read', 'users.read'].includes(permission)),
  );
  const canReadEvents = Boolean(
    roles.includes('ADMINISTRADOR') ||
    permissions.some((permission) => ['events.read', 'events.manage'].includes(permission)),
  );

  const modules = session
    ? MANAGEMENT_MODULES.filter((module) => canAccessManagementModule(module, roles, permissions))
    : [];
  const [removingDocument, setRemovingDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const hasDocument = Boolean(profile.data?.usuario.cliente?.documento);

  async function removeDocument() {
    if (removingDocument || !hasDocument) return;
    setRemovingDocument(true);
    setDocumentMessage(null);
    try {
      const response = await apiRequest<{ message: string }>('/perfil/documento', { method: 'DELETE', authenticated: true });
      setDocumentMessage(response.message);
      profile.retry();
    } catch (error) {
      setDocumentMessage(getErrorMessage(error));
    } finally {
      setRemovingDocument(false);
    }
  }
  return (
    <main className="panel-page panel-home panel-module--open">
      {profile.error && <StatusState kind="error" title="No pudimos cargar tus accesos" description={profile.error} actionLabel="Reintentar" onAction={profile.retry} />}

      {session && <>
        <DashboardCalendar canReadClients={canReadClients} canReadEvents={canReadEvents} />

        {profile.data?.usuario.cliente && <section className="document-management" aria-label="Documento de identidad">
          <div><p className="section-eyebrow">Mi cuenta</p><h2>Imagen de documento</h2><p>{hasDocument ? 'Tu imagen está guardada de forma segura.' : 'Aún no cargaste una imagen de documento.'}</p></div>
          {hasDocument && <button className="button button-outline" type="button" onClick={removeDocument} disabled={removingDocument}>{removingDocument ? 'Eliminando…' : 'Eliminar imagen'}</button>}
          {documentMessage && <small role="status">{documentMessage}</small>}
        </section>}

        <section className="panel-modules" id="modulos" aria-labelledby="panel-modules-title">
          <div className="panel-modules__heading">
            <div>
              <p>Gestión del estudio</p>
              <h2 id="panel-modules-title">Tus módulos</h2>
            </div>
            <span>{modules.length} disponibles</span>
          </div>
          {modules.length > 0 ? (
            <div className="management-grid">
              {modules.map((module) => (
                <Link href={`/panel/modulos/${module.slug}`} key={module.slug} aria-label={`Abrir ${module.title}`}>
                  <span className="management-grid__image" aria-hidden="true"><Image src={MODULE_IMAGES[module.slug]} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" /></span>
                  <div><small>{module.eyebrow}</small><h3>{module.title}</h3><p>{module.description}</p></div>
                </Link>
              ))}
            </div>
          ) : <StatusState kind="info" title="Sin módulos asignados" description="Tu sesión es válida, pero el administrador todavía no asignó permisos de módulos a tu rol." />}
        </section>
      </>}
    </main>
  );
}
