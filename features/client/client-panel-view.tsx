"use client";

import Link from "next/link";
import { ClientEvents } from './client-events';
import { ClientReservations } from './client-reservations';
import { AppIcon, type IconName } from '@/components/app-icon';
import { useEffect } from "react";
import { StatusState } from "@/components/status-state";
import { ScheduleView } from "@/features/schedule/schedule-view";
import { SessionBookingView } from "@/features/sessions/session-booking-view";
import { invalidateApiResourcesByPath, useApiResource } from "@/hooks/use-api-resource";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useClientAccount } from "@/hooks/use-client-account";
import { getPaymentStatus, type PendingMembershipPayment } from "@/lib/client-api";
import { STUDIO_TIME_ZONE } from "@/lib/studio-time";
const dateFormatter = new Intl.DateTimeFormat("es-BO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  // Membership dates are SQL DATE values serialized at midnight UTC, not instants.
  timeZone: "UTC",
});
const friendlyDateFormatter = new Intl.DateTimeFormat("es-BO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STUDIO_TIME_ZONE,
});

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function NoMembership({ what }: { what: string }) {
  return (
    <div className="client-empty">
      <StatusState
        title={`Todavía no tenés ${what}`}
        description="Cuando contrates un plan vas a ver acá todo lo que incluye."
      />
      <Link className="button button-dark" href="/memberships#membership-plans">
        Comprar membresía
      </Link>
    </div>
  );
}

function PendingPaymentCallout({ payment }: { payment: PendingMembershipPayment | null }) {
  if (!payment) return null;
  const expiration = payment.pago.qr_expiracion ? new Date(payment.pago.qr_expiracion) : null;
  const validUntil = expiration && !Number.isNaN(expiration.getTime())
    ? friendlyDateFormatter.format(expiration)
    : 'la hora indicada en el QR';
  return (
    <aside className="client-pending-payment" role="status">
      <div>
        <span>PAGO PENDIENTE</span>
        <strong>{payment.plan_nombre}</strong>
        <p>Tu código QR sigue disponible hasta {validUntil}. La membresía se activará cuando confirmemos el pago.</p>
      </div>
      <Link className="button button-dark" href={`/afiliacion/${encodeURIComponent(payment.plan_slug)}`}>
        Continuar pago
      </Link>
    </aside>
  );
}

export type ClientPanelSection = "Clases" | "Sesiones" | "Eventos" | "Membresia" | "Reservas";

export function ClientPanelView({ section }: { section?: ClientPanelSection }) {
  const session = useAuthSession();
  const account = useClientAccount(session);
  const pendingPayment = useApiResource<PendingMembershipPayment | null>("/pago/pendiente", true);
  const pendingId = pendingPayment.data?.pago.id;
  useEffect(() => {
    if (!pendingId) return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const result = await getPaymentStatus(pendingId);
        if (active && result.estado !== 'PENDIENTE') {
          ['/perfil', '/membresia/activa', '/pago/pendiente'].forEach(invalidateApiResourcesByPath);
        }
      } catch { /* El botón Continuar pago permite consultar y reintentar. */ }
      finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pendingId]);

  const sections: { key: ClientPanelSection; label: string; icon: IconName }[] = [
    { key: "Reservas", label: "Mis reservas", icon: "calendar" },
    { key: "Clases", label: "Reservar clases", icon: "calendar" },
    { key: "Sesiones", label: "Reservar sesiones", icon: "people" },
    { key: "Eventos", label: "Eventos", icon: "certificate" },
    { key: "Membresia", label: "Mi membresía", icon: "membership" },
  ];
  const membership = account.membership;
  const firstName = (account.profile?.usuario.nombre || session?.user.nombre || '').trim().split(/\s+/)[0];
  return (
    <section className={`panel-page panel-module--open client-panel${section === 'Clases' ? ' client-panel--classes' : ''}`}>
      <header className="client-section-heading">
        {section && <Link className="client-panel-back" href="/mi-panel"><AppIcon name="back" />Volver al panel</Link>}
        <h1>{section ? sections.find((item) => item.key === section)?.label : `Hola${firstName ? `, ${firstName}` : ""}`}</h1>
      </header>
      {!section && <nav className="client-home-menu" aria-label="Mi panel">
        {sections.map((item) => (
          <Link key={item.key} href={`/mi-panel/${item.key}`} aria-current={section === item.key ? "page" : undefined}>
            <AppIcon name={item.icon} /><strong>{item.label}</strong><span aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>}
      <PendingPaymentCallout payment={pendingPayment.data} />
      {pendingPayment.error && <StatusState kind="error" title="No pudimos consultar tus pagos" description={pendingPayment.error} actionLabel="Reintentar" onAction={pendingPayment.retry} />}
      {section === 'Reservas' ? <ClientReservations /> : account.error ? (
        <StatusState kind="error" title="No pudimos consultar tu membresía" description={account.error} actionLabel="Reintentar" onAction={account.refresh} />
      ) : account.loading || !session ? (
        <StatusState kind="loading" title="Cargando tu cuenta" description="Estamos consultando tu membresía." />
      ) : !membership ? (
        <NoMembership what="una membresía activa" />
      ) : <>
        {section === "Clases" && <>
          <section id="reservar" className="client-booking" aria-label="Reservar clases"><ScheduleView showIntro={false} /></section>
        </>}
        {section === "Sesiones" && <>
          <SessionBookingView />
        </>}
        {section === "Eventos" && <ClientEvents />}
        {section === "Membresia" && (
          <section className="client-membership-summary" aria-label="Tu membresía">
            <h2>{membership.nombre_plan_snapshot || membership.plan?.nombre || "Tu membresía"}</h2>
            <dl>
              <div><dt>Clases</dt><dd>{membership.clases_ilimitadas_snapshot ? "Ilimitadas" : membership.clases_disponibles ?? 0}</dd>{membership.limite_clases_semana_snapshot != null && <small>Hasta {membership.limite_clases_semana_snapshot} por semana</small>}</div>
              <div><dt>Sesiones</dt><dd>{(membership.beneficios || []).some(benefit => benefit.sesiones_ilimitadas) ? "Ilimitadas" : (membership.beneficios || []).reduce((total, benefit) => total + (benefit.sesiones_disponibles ?? 0), 0)}</dd></div>
              <div><dt>Eventos exclusivos</dt><dd>{membership.acceso_eventos ? "Sí" : "No"}</dd></div>
              <div><dt>Fecha de vencimiento</dt><dd>{formatDate(membership.fecha_fin)}</dd></div>
            </dl>
          </section>
        )}
      </>}
    </section>
  );
}
