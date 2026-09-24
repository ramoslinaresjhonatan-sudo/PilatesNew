'use client';

import { useEffect, useState } from 'react';
import { useApiResource } from '@/hooks/use-api-resource';
import { StatusState } from '@/components/status-state';
import type { ScheduleItem, ScheduleEnrollment } from '@/lib/types';

const zone = 'America/La_Paz';
const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dayLabel = (date: string) => new Intl.DateTimeFormat('es-BO', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00-04:00`));
const hour = (value: string) => new Intl.DateTimeFormat('es-BO', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
const labels: Record<string, string> = { RESERVADA: 'Reservado', CONFIRMADA: 'Confirmado', ASISTIO: 'Asistió', NO_ASISTIO: 'No asistió', CANCELADA: 'Cancelado' };

export function ScheduleOverview() {
  const [from, setFrom] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFrom(dateKey(new Date())));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const end = from ? new Date(`${from}T00:00:00-04:00`) : null;
  if (end) end.setUTCDate(end.getUTCDate() + 7);
  const query = from && end ? new URLSearchParams({ desde: `${from}T00:00:00-04:00`, hasta: new Date(end.getTime() - 1).toISOString() }) : null;
  const agenda = useApiResource<ScheduleItem[]>(query ? `/agenda?${query}` : null, true);
  const enrollments = useApiResource<ScheduleEnrollment[]>('/inscripcion', true);
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const filtered = [...(agenda.data || [])].filter((item) => terms.every((term) => normalize(`${item.actividad} ${item.coach || ''}`).includes(term))).sort((a, b) => Date.parse(a.fecha_inicio) - Date.parse(b.fecha_inicio));
  const groups = [...new Set(filtered.map((item) => dateKey(new Date(item.fecha_inicio))))];
  return <section className="connected-manager schedule-overview">
    <header className="staff-manager__header"><div><p className="section-eyebrow">Recepción · Reservas y asistencia</p><h1>Agenda del estudio</h1><p>Actividades de los próximos siete días desde la fecha elegida.</p></div><button className="button button-outline" type="button" onClick={() => { agenda.retry(); enrollments.retry(); }}>Actualizar</button></header>
    <div className="connected-toolbar membership-filters">
      <label><span>Buscar actividad</span><input type="search" placeholder="Actividad o coach" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label><span>Desde</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <button className="button button-outline" type="button" onClick={() => { setFrom(dateKey(new Date())); setSearch(''); }}>Volver a hoy</button>
    </div>
    {agenda.error ? <StatusState kind="error" title="No pudimos cargar la agenda" description={agenda.error} actionLabel="Reintentar" onAction={agenda.retry} /> : !from || agenda.loading ? <StatusState kind="loading" title="Cargando agenda" description="Consultando actividades por fecha." /> : <>
      <p role="status">{filtered.length} actividades · {groups.length} días con horarios</p>
      {groups.map((date) => <section key={date} className="schedule-day" aria-label={dayLabel(date)}><h2 className="schedule-day__title">{dayLabel(date)}</h2>
        <div className="connected-list">{filtered.filter((item) => dateKey(new Date(item.fecha_inicio)) === date).map((item) => <article key={item.agenda_actividad_id}>
          <div className="schedule-overview__time"><strong>{hour(item.fecha_inicio)}</strong><small>hasta {hour(item.fecha_fin)}</small></div>
          <div className="connected-list__main"><h3>{item.actividad}</h3><p>{item.coach || 'Coach por asignar'}</p></div>
          <div className="connected-list__numbers"><strong>{item.cupos_ocupados}/{item.cupos} reservados</strong><small>{item.cupos_disponibles} disponibles</small></div>
          <details className="schedule-roster"><summary>Ver inscritos y asistencia</summary>
            {enrollments.error ? <StatusState kind="error" title="No pudimos cargar los inscritos" description={enrollments.error} actionLabel="Reintentar" onAction={enrollments.retry} /> : enrollments.loading ? <p role="status">Cargando inscritos…</p> : <Roster entries={(enrollments.data || []).filter((entry) => entry.agenda_actividad_id === item.agenda_actividad_id)} />}
          </details>
        </article>)}</div>
      </section>)}
      {!filtered.length && <StatusState title="Sin actividades" description="No hay actividades publicadas que coincidan con este período y búsqueda." />}
    </>}
  </section>;
}

function Roster({ entries }: { entries: ScheduleEnrollment[] }) {
  const [status, setStatus] = useState('vigentes');
  const filtered = entries.filter((entry) => status === 'todos' || (status === 'asistieron' ? entry.estado === 'ASISTIO' : ['RESERVADA', 'CONFIRMADA'].includes(entry.estado)));
  return <div className="schedule-roster__body">
    <label>Mostrar <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="vigentes">Reservas pendientes de asistencia</option><option value="asistieron">Asistieron</option><option value="todos">Todos los registros</option></select></label>
    <p role="status">{filtered.length} de {entries.length} inscritos</p>
    <ul>{filtered.map((entry) => <li key={entry.id}><div><strong>{entry.cliente}</strong><small>{entry.correo} · {entry.plan}</small></div><span className="state-pill">{labels[entry.estado] || entry.estado}</span></li>)}</ul>
    {!filtered.length && <p>No hay inscritos en este grupo.</p>}
  </div>;
}
