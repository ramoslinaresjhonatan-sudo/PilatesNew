'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { eventStatus } from '@/lib/event-status';
import { createPortal } from 'react-dom';
import { useApiResource, invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { studioDateKey, studioTime, STUDIO_UTC_OFFSET } from '@/lib/studio-time';
import { StatusState } from '@/components/status-state';
import { useConfirm } from '@/components/confirm-dialog';
import type { HouseEvent, EventAttendee } from '@/lib/types';

type EventForm = { nombre: string; descripcion: string; fecha_inicio: string; fecha_fin: string; cupos: string; estado: 'BORRADOR' | 'PUBLICADA' | 'CANCELADA' };
const blank = (): EventForm => ({ nombre: '', descripcion: '', fecha_inicio: '', fecha_fin: '', cupos: '20', estado: 'BORRADOR' });
const localDate = (value: string) => `${studioDateKey(value)}T${studioTime(value)}`;

export function EventManager({ canManage }: { canManage: boolean }) {
  const events = useApiResource<HouseEvent[]>('/admin/evento', true);
  const [editing, setEditing] = useState<HouseEvent | null | undefined>();
  const [form, setForm] = useState<EventForm>(blank);
  const [selected, setSelected] = useState<HouseEvent | null>(null);
  const attendees = useApiResource<EventAttendee[]>(selected ? `/admin/evento/${selected.id}/inscripciones` : null, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const { confirm, confirmDialog } = useConfirm();
  const change = (key: keyof EventForm, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  function open(event?: HouseEvent) {
    setError(''); setEditing(event ?? null);
    setForm(event ? { nombre: event.nombre, descripcion: event.descripcion, fecha_inicio: localDate(event.fecha_inicio), fecha_fin: localDate(event.fecha_fin), cupos: String(event.cupos), estado: event.estado as EventForm['estado'] } : blank());
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (busy || editing === undefined) return;
    if (form.fecha_fin <= form.fecha_inicio) return setError('El fin debe ser posterior al inicio.');
    if (form.estado === 'CANCELADA' && !await confirm({ title: '¿Cancelar el evento?', description: 'Se cancelarán también las reservas de sus participantes.', confirmLabel: 'Cancelar evento', tone: 'danger' })) return;
    setBusy(true); setError('');
    try {
      await apiRequest(editing ? `/admin/evento/${editing.id}` : '/admin/evento', { method: editing ? 'PATCH' : 'POST', authenticated: true, body: { ...form, cupos: Number(form.cupos), fecha_inicio: new Date(`${form.fecha_inicio}:00${STUDIO_UTC_OFFSET}`).toISOString(), fecha_fin: new Date(`${form.fecha_fin}:00${STUDIO_UTC_OFFSET}`).toISOString() } });
      setEditing(undefined); ['/admin/evento', '/evento'].forEach(invalidateApiResourcesByPath);
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }
  async function attendance(id: string, estado: 'ASISTIO' | 'NO_ASISTIO') {
    if (!selected || busy) return; setBusy(true); setError('');
    try { await apiRequest(`/admin/evento/${selected.id}/inscripciones/${id}`, { method: 'PATCH', authenticated: true, body: { estado } }); attendees.retry(); invalidateApiResourcesByPath('/evento'); }
    catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }
  return <section className="connected-manager">
    <header className="staff-manager__header"><div><h2>Eventos exclusivos</h2><p>Solo pueden reservar clientes con acceso a eventos en su membresía. No se descuentan clases.</p></div>{canManage && <button className="button button-dark" type="button" onClick={() => open()}>+ Nuevo evento</button>}</header>
    {error && <p role="alert">{error}</p>}
    {events.loading && <StatusState kind="loading" title="Cargando eventos" description="Consultando fechas y cupos." />}
    {events.error && <StatusState kind="error" title="No pudimos cargar los eventos" description={events.error} actionLabel="Reintentar" onAction={events.retry} />}
    {!events.loading && !events.error && !events.data?.length && <p>No hay eventos creados.</p>}
    <div className="connected-list">{events.data?.map(event => <article key={event.id}>
      <div className="connected-list__main"><span className="state-pill">{eventStatus(event, now)}</span><h3>{event.nombre}</h3><p>{event.descripcion}</p><small>{formatDateTime(event.fecha_inicio)} — {formatDateTime(event.fecha_fin)}</small><p>{event.cupos_disponibles} de {event.cupos} cupos disponibles</p></div>
      <nav><button className="text-link" type="button" aria-label={`Ver participantes de ${event.nombre}`} onClick={() => { setSelected(event); setError(''); }}>Participantes</button>{canManage && event.estado !== 'CANCELADA' && Date.parse(event.fecha_inicio) > now && <button className="text-link" type="button" aria-label={`Editar ${event.nombre}`} onClick={() => open(event)}>Editar</button>}</nav>
    </article>)}</div>
    {selected && <section className="connected-manager"><header className="staff-manager__header"><h3>Participantes · {selected.nombre}</h3><button className="text-link" type="button" onClick={() => setSelected(null)}>Cerrar</button></header>
      {attendees.loading && <p>Cargando participantes…</p>}{attendees.error && <p role="alert">{attendees.error}</p>}
      {!attendees.loading && !attendees.error && !attendees.data?.length && <p>No hay inscripciones.</p>}
      <div className="connected-list">{attendees.data?.map(person => <article key={person.id}><div><strong>{person.cliente}</strong><p>{person.correo} · {person.plan}</p><span>{person.estado}</span></div>{canManage && person.estado !== 'CANCELADA' && selected.estado !== 'CANCELADA' && Date.parse(selected.fecha_inicio) <= now && <nav><button type="button" disabled={busy} onClick={() => void attendance(person.id, 'ASISTIO')}>Asistió</button><button type="button" disabled={busy} onClick={() => void attendance(person.id, 'NO_ASISTIO')}>No asistió</button></nav>}</article>)}</div>
    </section>}
    {editing !== undefined && typeof document !== 'undefined' && createPortal(<div className="staff-modal-layer"><form className="staff-form staff-modal event-form" role="dialog" aria-modal="true" aria-labelledby="event-form-title" onSubmit={save}>
      <header><div><h2 id="event-form-title">{editing ? 'Editar evento' : 'Nuevo evento'}</h2><p>Configurá los datos y la disponibilidad.</p></div><button className="staff-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={() => setEditing(undefined)}>×</button></header>
      <div className="staff-form__body">
        <label>Nombre<input required minLength={2} maxLength={120} value={form.nombre} onChange={e => change('nombre', e.target.value)} /></label>
        <label>Descripción<textarea maxLength={5000} value={form.descripcion} onChange={e => change('descripcion', e.target.value)} /></label>
        <div className="staff-form__grid">
          <label>Inicio<input required type="datetime-local" value={form.fecha_inicio} onChange={e => change('fecha_inicio', e.target.value)} /></label>
          <label>Fin<input required type="datetime-local" value={form.fecha_fin} onChange={e => change('fecha_fin', e.target.value)} /></label>
          <label>Cupos<input required type="number" min={1} max={999} step={1} value={form.cupos} onChange={e => change('cupos', e.target.value)} /></label>
          <label>Estado<select value={form.estado} onChange={e => change('estado', e.target.value)}><option value="BORRADOR">Borrador</option><option value="PUBLICADA">Publicado</option>{editing && <option value="CANCELADA">Cancelado</option>}</select></label>
        </div>
        <small>Horarios de Bolivia.</small>
        {editing && editing.cupos_disponibles < editing.cupos && <p>Hay reservas registradas: el horario se conserva. Podés cambiar la descripción, los cupos o cancelar.</p>}
        {error && <p className="staff-error" role="alert">{error}</p>}
      </div>
      <footer><button className="text-link" type="button" disabled={busy} onClick={() => setEditing(undefined)}>Cancelar</button><button className="button button-dark" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></footer>
    </form></div>, document.body)}{confirmDialog}
  </section>;
}
