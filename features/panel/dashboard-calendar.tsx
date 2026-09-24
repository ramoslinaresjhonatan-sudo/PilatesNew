'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useApiResource } from '@/hooks/use-api-resource';
import { formatDateTime } from '@/lib/format';
import { studioDateKey } from '@/lib/studio-time';
import type { HouseEvent, UpcomingBirthdayPerson } from '@/lib/types';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function atMidnight(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function eventDateKeys(event: HouseEvent) {
  const first = studioDateKey(event.fecha_inicio);
  const last = studioDateKey(event.fecha_fin);
  const current = new Date(`${first}T00:00:00.000Z`);
  const end = new Date(`${last}T00:00:00.000Z`);
  const keys: string[] = [];
  while (current <= end && keys.length < 366) {
    keys.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return keys;
}

export function DashboardCalendar({ canReadClients, canReadEvents }: { canReadClients: boolean; canReadEvents: boolean }) {
  const today = useMemo(() => atMidnight(new Date()), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today);
  const [birthdayPopoverOpen, setBirthdayPopoverOpen] = useState(false);
  const birthdays = useApiResource<UpcomingBirthdayPerson[]>(canReadClients ? '/cliente/cumpleanos' : null, true, { staleTimeMs: 20_000, maxAgeMs: 2 * 60_000 });
  const events = useApiResource<HouseEvent[]>(canReadEvents ? '/admin/evento' : null, true, { staleTimeMs: 20_000, maxAgeMs: 2 * 60_000 });
  const firstWeekday = (month.getDay() + 6) % 7;
  const firstVisibleDay = new Date(month.getFullYear(), month.getMonth(), 1 - firstWeekday);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay);
    date.setDate(firstVisibleDay.getDate() + index);
    return date;
  });

  function changeMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }
  const calendarKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const selectedBirthdays = (birthdays.data ?? []).filter((birthday) => birthday.fecha.slice(0, 10) === calendarKey(selectedDay));
  const birthdayDates = new Set((birthdays.data ?? []).map((birthday) => birthday.fecha.slice(0, 10)));
  const eventDates = new Set((events.data ?? []).flatMap(eventDateKeys));
  const selectedEvents = (events.data ?? []).filter((event) => eventDateKeys(event).includes(calendarKey(selectedDay)));

  return <div className="dashboard-overview">
    <section className="dashboard-calendar" aria-labelledby="dashboard-calendar-title">
      <header>
        <div>
          <p>Agenda</p>
          <h2 id="dashboard-calendar-title">Calendario</h2>
        </div>
        <Link href="/panel/calendario">Ver agenda</Link>
      </header>
      <div className="dashboard-calendar__month">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button>
        <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button>
      </div>
      <div className="dashboard-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="dashboard-calendar__grid" role="grid" aria-label={`${MONTHS[month.getMonth()]} de ${month.getFullYear()}`}>
        {days.map((day) => {
          const outsideMonth = day.getMonth() !== month.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, selectedDay);
          const hasBirthday = birthdayDates.has(calendarKey(day));
          const hasEvent = eventDates.has(calendarKey(day));
          const label = day.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          return (
            <button
              className={`${outsideMonth ? 'is-outside ' : ''}${isToday ? 'is-today ' : ''}${hasBirthday ? 'has-birthday ' : ''}${hasEvent ? 'has-event ' : ''}${isSelected ? 'is-selected' : ''}`}
              key={day.toISOString()}
              type="button"
              role="gridcell"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => {
                setSelectedDay(day);
                setBirthdayPopoverOpen(true);
                if (outsideMonth) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </section>
    <aside className="dashboard-today-card" aria-label="Fecha de hoy">
      <Image src="/assets/landing/4be263ec-c9ca-4178-bb9a-654687fc8d63.webp" alt="" fill sizes="(max-width: 900px) 100vw, 16rem" />
      <div>
        <p>Hoy</p>
        <strong>{today.toLocaleDateString('es-BO', { month: 'long' })}</strong>
        <span>{today.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric' })}</span>
      </div>
    </aside>
    <UpcomingBirthdays
      canReadClients={canReadClients}
      birthdays={birthdays.data}
      loading={birthdays.loading}
      error={birthdays.error}
      events={events.data}
      eventsLoading={events.loading}
      eventsError={events.error}
      selectedDay={selectedDay}
      selectedBirthdays={selectedBirthdays}
      selectedEvents={selectedEvents}
      open={birthdayPopoverOpen}
      onClose={() => setBirthdayPopoverOpen(false)}
    />
  </div>;
}

function UpcomingBirthdays({ canReadClients, birthdays, loading, error, events, eventsLoading, eventsError, selectedDay, selectedBirthdays, selectedEvents, open, onClose }: {
  canReadClients: boolean;
  birthdays?: UpcomingBirthdayPerson[] | null;
  loading: boolean;
  error: string | null;
  events?: HouseEvent[] | null;
  eventsLoading: boolean;
  eventsError: string | null;
  selectedDay: Date;
  selectedBirthdays: UpcomingBirthdayPerson[];
  selectedEvents: HouseEvent[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const displayedBirthdays = selectedBirthdays;
  const selectedDayLabel = selectedDay.toLocaleDateString('es-BO', { day: 'numeric', month: 'long' });

  return (
    <aside className="dashboard-upcoming-events dashboard-upcoming-events--popover" role="dialog" aria-modal="false" aria-labelledby="upcoming-events-title">
      <header>
        <div><p>Agenda del día</p><h2 id="upcoming-events-title">{selectedDayLabel}</h2></div>
        <div className="dashboard-upcoming-events__actions">
          {canReadClients && <Link href="/panel/modulos/clientes">Ver clientes</Link>}
          <button type="button" onClick={onClose} aria-label="Cerrar cumpleaños">×</button>
        </div>
      </header>
      {!canReadClients && <p className="dashboard-upcoming-events__empty">No tenés permiso para consultar clientes.</p>}
      {canReadClients && loading && <p className="dashboard-upcoming-events__empty">Cargando cumpleaños…</p>}
      {canReadClients && error && <p className="dashboard-upcoming-events__empty">No pudimos cargar los cumpleaños.</p>}
      {eventsLoading && <p className="dashboard-upcoming-events__empty">Cargando eventos…</p>}
      {eventsError && <p className="dashboard-upcoming-events__empty">No pudimos cargar los eventos.</p>}
      {!loading && !error && !eventsLoading && !eventsError && !displayedBirthdays.length && !selectedEvents.length && <p className="dashboard-upcoming-events__empty">No hay cumpleaños ni eventos el {selectedDayLabel}.</p>}
      {canReadClients && !loading && !error && displayedBirthdays.length > 0 && <section className="calendar-details__section"><h3>Cumpleaños</h3><ol>
        {displayedBirthdays.map((birthday) => {
          const date = new Date(birthday.fecha);
          return <li key={birthday.id}>
            <time dateTime={birthday.fecha}><strong>{date.toLocaleDateString('es-BO', { day: '2-digit', timeZone: 'UTC' })}</strong><span>{date.toLocaleDateString('es-BO', { month: 'short', timeZone: 'UTC' }).replace('.', '')}</span></time>
            <div><h3>{birthday.nombre}</h3><p>Está de cumpleaños</p></div>
            <small>🎂</small>
          </li>;
        })}
      </ol></section>}
      {!eventsLoading && !eventsError && selectedEvents.length > 0 && <section className="calendar-details__section"><h3>Eventos</h3><ol>
        {selectedEvents.map((event) => {
          const date = new Date(event.fecha_inicio);
          return <li key={event.id}>
            <time dateTime={event.fecha_inicio}><strong>{date.toLocaleDateString('es-BO', { day: '2-digit' })}</strong><span>{date.toLocaleDateString('es-BO', { month: 'short' }).replace('.', '')}</span></time>
            <div><h3>{event.nombre}</h3><p>{formatDateTime(event.fecha_inicio)}</p></div>
            <small>{event.estado.toLocaleLowerCase()}</small>
          </li>;
        })}
      </ol></section>}
    </aside>
  );
}
