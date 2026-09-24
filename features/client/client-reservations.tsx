'use client';

import { useEffect, useState } from 'react';
import { StatusState } from '@/components/status-state';
import { useConfirm } from '@/components/confirm-dialog';
import { ResilientImage } from '@/components/resilient-image';
import { apiRequest, getErrorMessage, safeAssetUrl } from '@/lib/api';
import { useApiResource, invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { formatDateTime } from '@/lib/format';
import { eventStatus } from '@/lib/event-status';
import type { HouseEvent, MyEnrollment } from '@/lib/types';

export function ClientReservations() {
  const enrollments = useApiResource<MyEnrollment[]>('/inscripcion/mias', true);
  const events = useApiResource<HouseEvent[]>('/evento', true);
  const { confirm, confirmDialog } = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function cancel(id: string, path: string) {
    if (busy || !(await confirm({ title: '¿Cancelar esta reserva?', description: 'El cupo quedará disponible nuevamente.', confirmLabel: 'Cancelar reserva', tone: 'danger' }))) return;
    setBusy(id); setError('');
    try {
      await apiRequest(path, { method: 'DELETE', authenticated: true });
      ['/inscripcion/mias', '/evento', '/admin/evento', '/agenda', '/perfil', '/membresia/activa'].forEach(invalidateApiResourcesByPath);
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(null); }
  }
  const [history, setHistory] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const reservations = [
    ...(enrollments.error ? [] : enrollments.data || []).map(item => ({ id: `class-${item.id}`, cancelPath: `/inscripcion/${item.id}`, name: item.actividad, category: item.categoria === 'SESION' ? 'Sesión' : 'Clase', start: item.fecha_inicio, end: item.fecha_fin, status: item.estado, coach: item.coach, image: item.coach_imagen })),
    ...(events.error ? [] : events.data || []).filter(item => item.inscripcion).map(item => ({ id: `event-${item.id}`, cancelPath: `/evento/${item.id}/reserva`, name: item.nombre, category: 'Evento', start: item.fecha_inicio, end: item.fecha_fin, status: item.estado === 'CANCELADA' ? 'CANCELADA' : item.inscripcion!.estado, finished: eventStatus(item, now) === 'FINALIZADA', coach: null, image: null })),
  ].filter(item => (('finished' in item && item.finished) || Date.parse(item.end) <= now || ['CANCELADA', 'NO_ASISTIO', 'ASISTIO'].includes(item.status)) === history)
    .sort((a, b) => history ? Date.parse(b.start) - Date.parse(a.start) : Date.parse(a.start) - Date.parse(b.start));
  const loading = enrollments.loading || events.loading;
  return <section className="client-reservation-list" aria-label="Mis reservas">
    <div className="client-events__filters" role="group" aria-label="Filtrar reservas">
      <button type="button" aria-pressed={!history} onClick={() => setHistory(false)}>Próximas</button>
      <button type="button" aria-pressed={history} onClick={() => setHistory(true)}>Historial</button>
    </div>
    {confirmDialog}
    {error && <p role="alert">{error}</p>}
    {loading && <StatusState kind="loading" title="Cargando reservas" description="" />}
    {enrollments.error && <StatusState kind="error" title="No pudimos cargar tus clases y sesiones" description={enrollments.error} actionLabel="Reintentar" onAction={enrollments.retry} />}
    {events.error && <StatusState kind="error" title="No pudimos cargar tus eventos" description={events.error} actionLabel="Reintentar" onAction={events.retry} />}
    {!loading && !enrollments.error && !events.error && !reservations.length && <StatusState title={history ? 'No tenés reservas anteriores' : 'No tenés próximas reservas'} description="" />}
    {!loading && reservations.map(item => <article className="client-reservation-row" key={item.id}>
      <div><span>{item.category}</span><h2>{item.name}</h2><time dateTime={item.start}>{formatDateTime(item.start)}</time><span className="client-reservation-row__end-time"> ? {formatDateTime(item.end, { hour: '2-digit', minute: '2-digit' })}</span></div>
      {item.coach && <div className="client-reservation-row__coach"><span className="booking-card__avatar">{item.image ? <ResilientImage src={safeAssetUrl(item.image.url, '', item.image.id)} alt={item.coach} loading="lazy" /> : <span aria-hidden="true">{item.coach.split(' ').map(word => word[0]).slice(0, 2).join('')}</span>}</span><div><small>Coach</small><strong>{item.coach}</strong></div></div>}
      <div className="client-reservation-row__actions">
      <span className="client-reservation-row__status">{item.status === 'NO_ASISTIO' ? 'No asistió' : item.status === 'ASISTIO' ? 'Asistió' : item.status.toLocaleLowerCase('es')}</span>
      {!history && Date.parse(item.start) > now && ['PENDIENTE', 'RESERVADA', 'CONFIRMADA'].includes(item.status) && <button className="button button-outline" type="button" disabled={busy !== null} onClick={() => void cancel(item.id, item.cancelPath)}>{busy === item.id ? 'Cancelando…' : 'Cancelar'}</button>}
      </div>
    </article>)}
  </section>;
}
