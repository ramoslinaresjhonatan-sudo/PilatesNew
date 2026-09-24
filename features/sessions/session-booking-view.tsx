'use client';

import { useRecentReservation } from '@/hooks/use-recent-reservation';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { StatusState } from '@/components/status-state';
import { ResilientImage } from '@/components/resilient-image';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useClientAccount } from '@/hooks/use-client-account';
import { getErrorMessage, safeAssetUrl } from '@/lib/api';
import { invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { requestSessionAppointment } from '@/lib/client-api';
import type { Activity } from '@/lib/types';
import { studioAddDays, studioDateKey, studioDateTimeIso } from '@/lib/studio-time';

export function SessionBookingView() {
  const session = useAuthSession();
  const account = useClientAccount(session, Boolean(session?.user.roles.includes('CLIENTE')));
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: 'error'; message: string } | null>(null);
  const { recent, mark } = useRecentReservation();
  const [submittedActivities, setSubmittedActivities] = useState<Activity[]>([]);
  const justReserved = Boolean(recent.session);
  const today = studioDateKey(new Date());
  const maxDate = studioAddDays(today, 60);
  const availableActivities = [...new Map(
    (account.membership?.beneficios || [])
      .filter(benefit => benefit.sesiones_ilimitadas || (benefit.sesiones_disponibles ?? 0) > 0)
      .flatMap(benefit => benefit.actividades || [])
      .filter(activity => activity.categoria === 'SESION' && activity.estado === 'ACTIVO')
      .map(activity => [activity.id, activity] as [string, Activity]),
  ).values()];
  const activities = justReserved ? submittedActivities : availableActivities;
  const selectedActivity = activities.find(activity => activity.id === selectedId) || activities[0];
  const selectedImage = selectedActivity?.imagenes?.[0];
  const imageUrl = safeAssetUrl(selectedImage?.url, '/img/spa.png', selectedImage?.id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || justReserved || account.membershipStatus !== 'active') return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const activityId = String(values.get('actividad_id') || '').trim();
    if (!activities.some(activity => activity.id === activityId)) {
      setResult({ kind: 'error', message: 'Seleccioná una sesión válida.' });
      return;
    }
    const date = String(values.get('fecha_preferida') || '');
    const time = String(values.get('hora_preferida') || '');
    if (!date || !time || date < studioDateKey(new Date()) || date > maxDate || Date.parse(studioDateTimeIso(date, time)) <= new Date().getTime()) {
      setResult({ kind: 'error', message: 'Elegí una fecha y hora futuras dentro de los próximos 60 días.' });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      await requestSessionAppointment({
        actividad_id: activityId,
        fecha_preferida: date,
        hora_preferida: time,
        comentario: String(values.get('comentario') || '').trim() || undefined,
      });
      setSubmittedActivities(activities);
      mark('session');
      form.reset();
      ['/inscripcion/mias', '/perfil', '/membresia/activa'].forEach(invalidateApiResourcesByPath);
      account.refresh();
    } catch (caught) {
      setResult({
        kind: 'error',
        message: getErrorMessage(caught),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const membershipMissing = account.membershipStatus === 'none';

  return (
    <section className="session-booking" aria-label="Reservar una sesión">
      <div className="session-booking__image">
        <ResilientImage key={imageUrl} src={imageUrl} alt={selectedImage?.texto_alt || (selectedImage ? selectedActivity?.nombre : 'Espacio de bienestar House')} />
      </div>

      <div className="session-booking__card">
        {result && <p className={`session-booking__notice session-booking__notice--${result.kind}`} role={result.kind === 'error' ? 'alert' : 'status'}>{result.message}</p>}
        {account.loading && !justReserved && <StatusState kind="loading" title="Cargando sesiones" description="Estamos consultando los servicios disponibles." />}
        {account.error && <StatusState kind="error" title="No pudimos cargar las sesiones" description={account.error} actionLabel="Reintentar" onAction={account.refresh} />}
        {(!account.loading || justReserved) && !account.error && activities.length === 0 && <StatusState kind="empty" title="Sin sesiones disponibles" description="Tu membresía no tiene sesiones disponibles para reservar." />}
        {(!account.loading || justReserved) && !account.error && activities.length > 0 && (
          <form className="session-booking__form" onSubmit={submit}>
            <label><span>Tipo de sesión</span><select disabled={justReserved} name="actividad_id" required value={selectedActivity?.id || ''} onChange={event => { setSelectedId(event.target.value); setResult(null); }}>{activities.map((activity) => <option value={activity.id} key={activity.id}>{activity.nombre}</option>)}</select></label>
            <div className="session-booking__row">
              <label><span>Día de preferencia</span><input disabled={justReserved} name="fecha_preferida" type="date" min={today} max={maxDate} required /></label>
              <label><span>Hora de preferencia</span><input disabled={justReserved} name="hora_preferida" type="time" min="07:00" max="21:00" step="900" required /></label>
            </div>
            <label><span>Comentario <small>Opcional</small></span><textarea disabled={justReserved} name="comentario" maxLength={240} rows={4} placeholder="Contanos si necesitás alguna consideración especial." /></label>
            {account.error && <StatusState kind="error" title="No pudimos consultar tu membresía" description={account.error} actionLabel="Reintentar" onAction={account.refresh} />}
            {justReserved ? (
              <Link className="button button-dark reservation-success-link" href="/mi-panel/Reservas">Ver reservaciones</Link>
            ) : !session ? (
              <Link className="booking-button booking-button--solid" href={`/login?next=${encodeURIComponent('/mi-panel/Sesiones')}`}>Ingresar para solicitar</Link>
            ) : membershipMissing ? (
              <Link className="booking-button booking-button--solid" href="/memberships#membership-plans">Comprar una membresía</Link>
            ) : (
              <button className="button button-dark" type="submit" disabled={submitting || account.membershipStatus !== 'active'}>{submitting ? 'Enviando…' : 'Solicitar cita'}</button>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
