'use client';

import Link from 'next/link';
import { useRecentReservation } from '@/hooks/use-recent-reservation';
import { useEffect, useState } from 'react';
import { useApiResource, invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { StatusState } from '@/components/status-state';
import { useConfirm } from '@/components/confirm-dialog';
import type { HouseEvent } from '@/lib/types';
import { STUDIO_TIME_ZONE } from '@/lib/studio-time';
import { eventStatus } from '@/lib/event-status';

const eventDay = new Intl.DateTimeFormat('es-BO', { day: '2-digit', timeZone: STUDIO_TIME_ZONE });
const eventMonth = new Intl.DateTimeFormat('es-BO', { month: 'short', year: 'numeric', timeZone: STUDIO_TIME_ZONE });

export function ClientEvents() {
  const events = useApiResource<HouseEvent[]>('/evento', true);
  const [busy, setBusy] = useState(false);
  const { recent, mark } = useRecentReservation();
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const visible = (events.data ?? [])
    .filter(event => (Date.parse(event.fecha_fin) <= now || eventStatus(event, now) === 'FINALIZADA') === (view === 'past'))
    .sort((a, b) => view === 'past' ? Date.parse(b.fecha_inicio) - Date.parse(a.fecha_inicio) : Date.parse(a.fecha_inicio) - Date.parse(b.fecha_inicio));
  const { confirm, confirmDialog } = useConfirm();
  async function reserve(event: HouseEvent) {
    if (busy) return;
    const accepted = await confirm({ title: `¿Reservar ${event.nombre}?`, description: formatDateTime(event.fecha_inicio), confirmLabel: 'Reservar evento' });
    if (!accepted) return;
    setBusy(true); setError('');
    try {
      await apiRequest<{ message: string }>(`/evento/${event.id}/reserva`, { method: 'POST', authenticated: true });
      mark(event.id); ['/evento', '/admin/evento'].forEach(invalidateApiResourcesByPath);
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }
  return <section id="eventos" className="client-events" aria-label="Eventos disponibles">
    <div className="client-events__toolbar">
      <div className="client-events__filters" role="group" aria-label="Filtrar eventos"><button type="button" aria-pressed={view === 'upcoming'} onClick={() => setView('upcoming')}>Próximos y en curso</button><button type="button" aria-pressed={view === 'past'} onClick={() => setView('past')}>Eventos pasados</button></div>
      {!events.loading && !events.error && <span>{visible.length} {visible.length === 1 ? 'encuentro' : 'encuentros'}</span>}
    </div>
    {error && <p className="client-events__notice" role="alert">{error}</p>}
    {events.loading && <StatusState kind="loading" title="Cargando eventos" description="Buscando las próximas fechas." />}
    {events.error && <StatusState kind="error" title="No pudimos cargar los eventos" description={events.error} actionLabel="Reintentar" onAction={events.retry} />}
    {!events.loading && !events.error && !visible.length && <div className="client-events__empty"><span className="client-events__eyebrow">{view === 'past' ? 'NUESTROS ENCUENTROS' : 'LO QUE VIENE'}</span><h3>{view === 'past' ? 'Todavía no hay eventos pasados' : 'Nos volvemos a encontrar pronto'}</h3><p>{view === 'past' ? 'Acá vas a poder consultar las experiencias que ya compartimos.' : 'Estamos preparando nuevas experiencias. Las próximas fechas aparecerán en este espacio.'}</p></div>}
    {!events.loading && !events.error && <div className="client-events__grid">{visible.map(event => {
      const reserved = event.inscripcion && event.inscripcion.estado !== 'CANCELADA';
      const finished = eventStatus(event, now) === 'FINALIZADA';
      const started = Date.parse(event.fecha_inicio) <= now;
      const cancelled = event.estado === 'CANCELADA';
      const status = cancelled ? 'Cancelado' : finished ? 'Finalizado' : started ? 'En curso' : reserved ? 'Tu lugar está reservado' : event.cupos_disponibles === 0 ? 'Completo' : 'Próximo encuentro';
      return <article className="client-event-card" key={event.id} aria-labelledby={`event-title-${event.id}`}>
        <header className="client-event-card__header">
          <time className="client-event-card__date" dateTime={event.fecha_inicio}><strong>{eventDay.format(new Date(event.fecha_inicio))}</strong><span>{eventMonth.format(new Date(event.fecha_inicio))}</span></time>
          <span className={`client-event-card__badge${reserved && !cancelled && !finished ? ' client-event-card__badge--reserved' : ''}`}>{status}</span>
        </header>
        <div className="client-event-card__body"><h3 id={`event-title-${event.id}`}>{event.nombre}</h3>{event.descripcion && <p>{event.descripcion}</p>}
          <dl className="client-event-card__details"><div><dt>Comienza</dt><dd><time dateTime={event.fecha_inicio}>{formatDateTime(event.fecha_inicio)}</time></dd></div><div><dt>Finaliza</dt><dd><time dateTime={event.fecha_fin}>{formatDateTime(event.fecha_fin)}</time></dd></div></dl>
        </div>
        <footer className="client-event-card__footer">
          {!cancelled && !finished && !started && <p className="client-event-card__capacity">{event.cupos_disponibles > 0 ? `${event.cupos_disponibles} ${event.cupos_disponibles === 1 ? 'lugar disponible' : 'lugares disponibles'}` : 'Sin cupos disponibles'}</p>}
          {!cancelled && !finished && !started && !reserved && (!event.tiene_acceso ? <p>Tu membresía no incluye acceso vigente para este evento.</p> : !event.puede_reservar && event.cupos_disponibles > 0 ? <p>Inscripciones cerradas.</p> : null)}
          {started && !finished && !cancelled && <p>Inscripciones cerradas. El encuentro ya comenzó.</p>}
          {recent[event.id] ? <Link className="button button-dark reservation-success-link" href="/mi-panel/Reservas">Ver reservaciones</Link> : event.puede_reservar && !reserved && !cancelled && !started && !finished && <button className="button button-dark" type="button" disabled={busy} onClick={() => void reserve(event)}>Reservar mi lugar <span aria-hidden="true">↗</span></button>}
        </footer>
      </article>;
    })}</div>}{confirmDialog}
  </section>;
}
