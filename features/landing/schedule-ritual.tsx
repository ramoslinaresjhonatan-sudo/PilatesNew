'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatusState } from '@/components/status-state';
import { useApiResource } from '@/hooks/use-api-resource';
import { useAuthSession } from '@/hooks/use-auth-session';
import { getPostLoginDestination } from '@/lib/auth';
import { studioAddDays, studioDateKey, studioDateTimeIso, STUDIO_TIME_ZONE } from '@/lib/studio-time';
import type { ScheduleItem } from '@/lib/types';
import './schedule-ritual.css';

/** Mismos estados que ya se descartan en el resto de la agenda pública. */
const UNAVAILABLE_STATES = new Set(['BORRADOR', 'CANCELADA', 'CANCELADO', 'SUSPENDIDA', 'SUSPENDIDO']);

/** A partir de cuántos cupos la disponibilidad deja de mostrarse como escasa. */
const LOW_AVAILABILITY_THRESHOLD = 5;

/** Cuántos días con clases se muestran como pestañas antes de mandar a la agenda completa. */
const MAX_DAY_TABS = 5;

const weekdayFormatter = new Intl.DateTimeFormat('es-BO', { weekday: 'long', timeZone: STUDIO_TIME_ZONE });
const dayNumberFormatter = new Intl.DateTimeFormat('es-BO', { day: 'numeric', timeZone: STUDIO_TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: STUDIO_TIME_ZONE });

function Line({ className = '' }: { className?: string }) {
  return <span className={`landing-skeleton__line ${className}`.trim()} />;
}

function ScheduleSkeleton() {
  return (
    <div className="landing-skeleton landing-skeleton--schedule" role="status" aria-busy="true">
      <span className="sr-only">Cargando las próximas clases</span>
      <span className="landing-skeleton__image" />
      <div className="landing-skeleton__schedule-copy">
        <Line className="landing-skeleton__line--small" />
        <Line className="landing-skeleton__line--large" />
        <Line className="landing-skeleton__line--medium" />
        <Line className="landing-skeleton__button" />
      </div>
    </div>
  );
}

export function ScheduleRitual() {
  const session = useAuthSession();
  const bookingHref = session ? getPostLoginDestination(session, '/mi-panel/Clases') : '/login?next=%2Fmi-panel';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* Ventana de dos semanas, igual que el resto de la agenda pública. */
  const schedulePath = useMemo(() => {
    const desde = studioDateKey(new Date());
    const hasta = studioAddDays(desde, 13);
    const query = new URLSearchParams({
      categoria: 'CLASE',
      desde: studioDateTimeIso(desde, '00:00'),
      hasta: studioDateTimeIso(hasta, '00:00', true),
    });
    return `/agenda?${query}`;
  }, []);
  const resource = useApiResource<ScheduleItem[]>(schedulePath);

  const days = useMemo(() => {
    const todayKey = studioDateKey(now);
    const tomorrowKey = studioAddDays(todayKey, 1);
    const groups = new Map<string, ScheduleItem[]>();

    (resource.data || [])
      .filter((item) => !UNAVAILABLE_STATES.has(String(item.estado).toUpperCase()) && !UNAVAILABLE_STATES.has(String(item.estado_clase).toUpperCase()))
      .filter((item) => item.cupos_disponibles > 0)
      .filter((item) => new Date(item.fecha_inicio).getTime() > now.getTime())
      .forEach((item) => {
        const key = studioDateKey(item.fecha_inicio);
        const group = groups.get(key) || [];
        group.push(item);
        groups.set(key, group);
      });

    return [...groups.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .slice(0, MAX_DAY_TABS)
      .map(([key, items]) => {
        const sorted = [...items].sort((first, second) => new Date(first.fecha_inicio).getTime() - new Date(second.fecha_inicio).getTime());
        const date = new Date(`${key}T12:00:00Z`);
        const dayNumber = dayNumberFormatter.format(date);
        const label = key === todayKey ? `Hoy ${dayNumber}` : key === tomorrowKey ? `Mañana ${dayNumber}` : `${weekdayFormatter.format(date)} ${dayNumber}`;
        return { key, label, items: sorted };
      });
  }, [resource.data, now]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay = (selectedDay && days.find((day) => day.key === selectedDay)) || days[0] || null;

  const highlightId = useMemo(() => {
    if (!activeDay) return null;
    const scarce = activeDay.items
      .filter((item) => item.cupos_disponibles > 0 && item.cupos_disponibles <= LOW_AVAILABILITY_THRESHOLD)
      .sort((first, second) => first.cupos_disponibles - second.cupos_disponibles);
    return scarce[0]?.agenda_actividad_id ?? null;
  }, [activeDay]);

  return (
    <section className="schedule-ritual" aria-labelledby="schedule-ritual-title">
      <div className="schedule-ritual__intro">
        <p className="schedule-ritual__eyebrow">Your time · Your flow · Your ritual</p>
        <h1 id="schedule-ritual-title">Tu momento empieza acá.</h1>
        <p className="schedule-ritual__copy">Elegí la clase que acompaña tu energía de hoy.</p>
      </div>

      <div className="schedule-ritual__panel">
        {resource.loading && <ScheduleSkeleton />}
        {resource.error && <StatusState kind="error" title="No pudimos cargar los horarios" description={resource.error} actionLabel="Reintentar" onAction={resource.retry} />}
        {!resource.loading && !resource.error && days.length === 0 && (
          <StatusState title="Sin próximas clases" description="Todavía no hay horarios publicados para los próximos días." />
        )}

        {!resource.loading && !resource.error && days.length > 0 && activeDay && (
          <div className="schedule-ritual__card">
            <header className="schedule-ritual__card-heading">
              <h2>Próximas clases</h2>
              <div className="schedule-ritual__tagline">
                <p className="schedule-ritual__tagline-eyebrow">Book your ritual</p>
                <p className="schedule-ritual__tagline-script">Movement, on your time.</p>
              </div>
            </header>

            <div className="schedule-ritual__tabs" role="tablist" aria-label="Elegir día">
              {days.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  role="tab"
                  aria-selected={day.key === activeDay.key}
                  className={day.key === activeDay.key ? 'is-active' : ''}
                  onClick={() => setSelectedDay(day.key)}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <ul className="schedule-ritual__list">
              {activeDay.items.map((item) => {
                const start = new Date(item.fecha_inicio);
                const highlighted = item.agenda_actividad_id === highlightId;
                return (
                  <li className={`schedule-ritual__row${highlighted ? ' schedule-ritual__row--highlight' : ''}`} key={item.agenda_actividad_id}>
                    <time className="schedule-ritual__time" dateTime={item.fecha_inicio}>{timeFormatter.format(start)}</time>
                    <div className="schedule-ritual__details">
                      <strong>{item.actividad}</strong>
                      <span>{item.coach || 'el equipo Pilates House'}</span>
                    </div>
                    <Link className={`schedule-ritual__reserve${highlighted ? ' schedule-ritual__reserve--solid' : ''}`} href={bookingHref}>Reservar</Link>
                  </li>
                );
              })}
            </ul>

            <p className="schedule-ritual__note">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-10Z" /><path d="M12 8v9" /></svg>
              Tu membresía te acompaña. Reservá, movete y disfrutá la House.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
