'use client';

import { useRecentReservation } from '@/hooks/use-recent-reservation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { classStatus } from '@/lib/class-status';
import { ResilientImage } from '@/components/resilient-image';
import { LandingSectionLink } from '@/components/landing-section-link';
import { StatusState } from '@/components/status-state';
import { useConfirm } from '@/components/confirm-dialog';
import { invalidateApiResourcesByPath, useApiResource } from '@/hooks/use-api-resource';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useClientAccount } from '@/hooks/use-client-account';
import { ApiError, getErrorMessage, safeAssetUrl } from '@/lib/api';
import { reserveClass } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { STUDIO_TIME_ZONE, studioDateKey, studioDateTimeIso } from '@/lib/studio-time';
import type { MyEnrollment, ScheduleItem } from '@/lib/types';

const weekdayShort = new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: STUDIO_TIME_ZONE });
const longDate = new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: STUDIO_TIME_ZONE });

type ReservationState = { kind: 'idle' | 'loading' | 'success' | 'error'; message?: string };

function apiDate(key: string, endOfDay = false) {
  return studioDateTimeIso(key, '00:00', endOfDay);
}

function getPeriod(value: string) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: STUDIO_TIME_ZONE }).format(new Date(value)));
  if (hour < 12) return 'mañana';
  if (hour < 18) return 'tarde';
  return 'noche';
}

export function ScheduleView({ panel = false, showIntro = true }: { panel?: boolean; showIntro?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const session = useAuthSession();
  const { confirm, confirmDialog } = useConfirm();
  const enrolled = useApiResource<MyEnrollment[]>(!panel && session?.user.roles.includes('CLIENTE') ? '/inscripcion/mias' : null, true);
  const account = useClientAccount(session, !panel && Boolean(session?.user.roles.includes('CLIENTE')));
  const days = useMemo(() => {
    const [year, month, day] = studioDateKey(new Date()).split('-').map(Number);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1, day + index, 12));
      return { key: date.toISOString().slice(0, 10), date, isToday: index === 0 };
    });
  }, []);
  const [selectedDay, setSelectedDay] = useState(days[0].key);
  const [selectedClass, setSelectedClass] = useState('');
  const [reservations, setReservations] = useState<Record<string, ReservationState>>({});
  const { recent: recentErrors, mark: markError } = useRecentReservation();
  const daysRef = useRef<HTMLDivElement>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams({
      desde: apiDate(selectedDay),
      hasta: apiDate(selectedDay, true),
      categoria: 'CLASE',
    });
    return `/agenda?${params.toString()}`;
  }, [selectedDay]);

  const schedule = useApiResource<ScheduleItem[]>(path, false, { staleTimeMs: 0, refreshIntervalMs: 5000 });
  const items = useMemo(
    () => [...(schedule.data || [])]
      .filter((item) => item.categoria === 'CLASE')
      .filter((item) => Date.parse(item.fecha_fin) > now && !['FINALIZADA', 'FINISHED'].includes(String(item.estado).toUpperCase()) && !['FINALIZADA', 'FINISHED'].includes(String(item.estado_clase).toUpperCase()))
      .filter((item) => !['BORRADOR', 'CANCELADA', 'CANCELADO', 'SUSPENDIDA', 'SUSPENDIDO'].includes(String(item.estado).toUpperCase()) && !['BORRADOR', 'CANCELADA', 'CANCELADO', 'SUSPENDIDA', 'SUSPENDIDO'].includes(String(item.estado_clase).toUpperCase()))
      .sort((a, b) => Date.parse(a.fecha_inicio) - Date.parse(b.fecha_inicio)),
    [schedule.data, now],
  );
  const currentDay = days.find((day) => day.key === selectedDay) || days[0];
  const classOptions = [...new Map(items.map(item => [item.actividad_id, item.actividad])).entries()];
  const activeClass = classOptions.some(([id]) => id === selectedClass) ? selectedClass : '';
  const filteredItems = activeClass ? items.filter(item => item.actividad_id === activeClass) : items;

  async function submitReservation(agendaId: string) {
    if (reservations[agendaId]?.kind === 'loading') return;
    const item = items.find((entry) => entry.agenda_actividad_id === agendaId);
    if (!item || account.membershipStatus !== 'active') return;
    if (!(await confirm({ title: '¿Confirmás tu reserva?', description: `${item.actividad} · ${formatDateTime(item.fecha_inicio)}. Se aplican los límites de tu membresía.`, confirmLabel: 'Reservar clase' }))) return;
    setReservations((current) => ({ ...current, [agendaId]: { kind: 'loading' } }));
    try {
      await reserveClass(agendaId);
      setReservations((current) => ({
        ...current,
        [agendaId]: { kind: 'success' },
      }));
      schedule.retry();
      invalidateApiResourcesByPath('/inscripcion/mias');
      invalidateApiResourcesByPath('/perfil');
      invalidateApiResourcesByPath('/membresia/activa');
    } catch (caught) {
      schedule.retry();
      markError(agendaId);
      const endpointPending = caught instanceof ApiError && [404, 405].includes(caught.status);
      setReservations((current) => ({
        ...current,
        [agendaId]: {
          kind: 'error',
          message: endpointPending
            ? 'Todavía no se puede reservar desde acá. No se creó ninguna reserva.'
            : getErrorMessage(caught),
        },
      }));
    }
  }

  return (
    <section className={`booking-section${panel ? ' booking-section--panel' : ''}`} id="horarios" aria-label="Horarios y reservas de clases" onClickCapture={(event) => {
      if (event.target instanceof Element && event.target.closest('button, a')) invalidateApiResourcesByPath('/agenda?');
    }}>
      {confirmDialog}
      {showIntro && <div className="booking-section__header booking-section__header--compact">
        <p>Seleccioná el día y la clase que querés reservar. Las sesiones personalizadas se agendan por separado.</p>
        <div className="booking-section__actions">
          <Link className="booking-button booking-button--outline" href="/vanesa">Conocé a las instructoras</Link>
        </div>
      </div>}

      <div className="booking-days">
        <button className="booking-days__arrow" type="button" aria-label="Ver días anteriores" onClick={() => daysRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}>‹</button>
        <div className="booking-days__track" ref={daysRef}>
          {days.map((day) => (
            <button className={day.key === selectedDay ? 'booking-day booking-day--active' : 'booking-day'} key={day.key} type="button" aria-label={longDate.format(day.date)} aria-pressed={day.key === selectedDay} onClick={() => { setSelectedDay(day.key); setSelectedClass(''); }}>
              <span>{day.isToday ? 'HOY' : weekdayShort.format(day.date).replace('.', '').toUpperCase()}</span>
              <strong>{day.date.getDate()}</strong>
            </button>
          ))}
        </div>
        <button className="booking-days__arrow" type="button" aria-label="Ver días siguientes" onClick={() => daysRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}>›</button>
      </div>

      {!schedule.loading && !schedule.error && <div className="booking-class-filters" role="group" aria-label="Filtrar por clase">
        <button type="button" aria-pressed={!activeClass} onClick={() => setSelectedClass('')}>Todas</button>
        {classOptions.map(([id, name]) => <button key={id} type="button" aria-pressed={activeClass === id} onClick={() => setSelectedClass(id)}>{name}</button>)}
      </div>}

      {schedule.loading && <StatusState kind="loading" title="Consultando horarios" description="Estamos preparando la agenda de clases del estudio." />}
      {schedule.error && <StatusState kind="error" title="No pudimos cargar la agenda" description={schedule.error} actionLabel="Reintentar" onAction={schedule.retry} />}
      {enrolled.error && <StatusState kind="error" title="No pudimos consultar tus reservas" description={enrolled.error} actionLabel="Reintentar" onAction={enrolled.retry} />}

      {!schedule.loading && !schedule.error && (
        <div className="booking-list">
          {filteredItems.map((item) => {
            const state = classStatus(item, now);
            const reservation = reservations[item.agenda_actividad_id] || { kind: 'idle' };
            const occupancy = item.cupos > 0 ? (item.cupos_disponibles / item.cupos) * 100 : 0;
            const membershipMissing = !panel && account.membershipStatus === 'none';
            const alreadyReserved = (enrolled.data || []).some((entry) => entry.agenda_actividad_id === item.agenda_actividad_id && ['RESERVADA', 'CONFIRMADA', 'ASISTIO'].includes(entry.estado));
            return (
              <article className={state.code === 'FIN' ? 'booking-card booking-card--past' : 'booking-card'} key={item.agenda_actividad_id}>
                <div className="booking-card__main">
                  <span className="booking-card__time">{formatDateTime(item.fecha_inicio, { hour: '2-digit', minute: '2-digit' })} <em>—</em> {formatDateTime(item.fecha_fin, { hour: '2-digit', minute: '2-digit' })}</span>
                  <h3>{item.actividad}</h3>
                  <span className="booking-card__period">Turno {getPeriod(item.fecha_inicio)}</span>
                  <span className={`booking-card__state booking-card__state--${state.code.toLowerCase()}`} title={state.description}>{state.code}</span>
                </div>
                <div className="booking-card__coach">
                  <span className="booking-card__avatar">
                    {item.coach_imagen ? <ResilientImage src={safeAssetUrl(item.coach_imagen.url, '', item.coach_imagen.id)} alt={item.coach || 'Coach'} loading="lazy" /> : <span aria-hidden="true">{item.coach?.split(' ').map(word => word[0]).slice(0, 2).join('') || '—'}</span>}
                  </span>
                  <div><span className="booking-card__label">COACH</span>
                  <span className="booking-card__coach-button" aria-label={item.coach ? `Coach ${item.coach}` : 'Coach no informado por la agenda'}>{item.coach || '—'}</span></div>
                </div>
                <div className="booking-card__seats">
                  <span className="booking-card__label">CUPOS</span>
                  <p><strong>{item.cupos_disponibles}</strong> de {item.cupos}</p>
                  <span className="booking-card__seats-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, occupancy))}%` }} /></span>
                </div>
                <div className="booking-card__action">
                  {state.code === 'FIN' || state.code === 'ONGOING' ? (
                    <span className="booking-button booking-button--solid booking-button--disabled" role="status">{state.description}</span>
                  ) : alreadyReserved || reservation.kind === 'success' ? <Link className="booking-button booking-button--solid reservation-success-link" href="/mi-panel/Reservas">Reservada</Link> : state.disabled ? (
                    <span className="booking-button booking-button--solid booking-button--disabled" aria-disabled="true">{state.description}</span>
                  ) : panel ? (
                    <a className="booking-button booking-button--solid" href="#reservas">Gestionar</a>
                  ) : !session ? (
                    <Link className="booking-button booking-button--solid" href="/login">Ingresar para reservar</Link>
                  ) : membershipMissing ? (
                    <LandingSectionLink className="booking-button booking-button--solid" section="membresias">Ver membresías</LandingSectionLink>
                  ) : (
                    <button className="booking-button booking-button--solid" type="button" disabled={account.membershipStatus !== 'active' || enrolled.loading || Boolean(enrolled.error) || reservation.kind === 'loading'} onClick={() => void submitReservation(item.agenda_actividad_id)}>
                      {reservation.kind === 'loading' ? 'Reservando…' : 'Reservar'}
                    </button>
                  )}
                  <div className="booking-card__feedback-slot" aria-live="polite" aria-atomic="true">
                    {reservation.kind === 'error' && recentErrors[item.agenda_actividad_id] && <small className="booking-card__feedback booking-card__feedback--error">{reservation.message}</small>}
                  </div>
                </div>
              </article>
            );
          })}
          {items.length === 0 && <p className="booking-empty">No quedan clases por realizar el {longDate.format(currentDay.date).toLowerCase()}.</p>}
        </div>
      )}

      {panel && <div className="notice-card" id="reservas"><span aria-hidden="true">i</span><div><h3>Reservas conectadas a la agenda</h3><p>Los cupos se consultan en tiempo real. La gestión del equipo permanecerá separada del flujo de reservas del cliente.</p></div></div>}
    </section>
  );
}
