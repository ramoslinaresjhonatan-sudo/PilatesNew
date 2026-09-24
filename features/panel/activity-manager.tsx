'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirm } from '@/components/confirm-dialog';
import { ResilientImage } from '@/components/resilient-image';
import { apiRequest, getErrorMessage, safeAssetUrl } from '@/lib/api';
import { getCategoryLabel } from '@/lib/catalog';
import type { Activity, KnownActivityCategory } from '@/lib/types';

/**
 * El modulo se divide por tipo de disciplina. Los tres nombres son femeninos,
 * asi que "activas" y "anuladas" sirven para cualquiera de los tres.
 */
const TYPE_ORDER: KnownActivityCategory[] = ['CLASE', 'SESION', 'EXPERIENCIA'];
const TYPE_COPY: Record<KnownActivityCategory, { plural: string; singular: string }> = {
  CLASE: { plural: 'Clases', singular: 'clase' },
  SESION: { plural: 'Sesiones', singular: 'sesión' },
  EXPERIENCIA: { plural: 'Experiencias', singular: 'experiencia' },
  EVENTO: { plural: 'Eventos', singular: 'evento' },
};

function typeOf(activity: Activity): KnownActivityCategory {
  const value = String(activity.categoria).trim().toUpperCase();
  return TYPE_ORDER.includes(value as KnownActivityCategory) ? (value as KnownActivityCategory) : 'CLASE';
}

type Form = {
  categoria: KnownActivityCategory;
  nombre: string;
  subtitulo: string;
  descripcion_corta: string;
  requiere_reserva: boolean;
  visible_landing: boolean;
};

const blank = (categoria: KnownActivityCategory): Form => ({
  categoria, nombre: '', subtitulo: '', descripcion_corta: '', requiere_reserva: true,
  visible_landing: true,
});

function fromActivity(categoria: KnownActivityCategory, activity?: Activity): Form {
  return activity ? {
    categoria: typeOf(activity),
    nombre: activity.nombre,
    subtitulo: activity.subtitulo || '',
    descripcion_corta: activity.descripcion_corta || '',
    requiere_reserva: Boolean(activity.requiere_reserva),
    visible_landing: Boolean(activity.visible_landing),
  } : blank(categoria);
}

function ActivityThumbnail({ activity }: { activity: Activity }) {
  const [failed, setFailed] = useState(false);
  const image = activity.imagenes?.[0];
  const source = safeAssetUrl(image?.url, '', image?.id);
  if (!source || failed) return <b>{activity.categoria[0]}</b>;
  return <span className="activity-list__image"><ResilientImage src={source} alt={`Imagen de ${activity.nombre}`} onError={() => setFailed(true)} /></span>;
}

export function ActivityManager({ activities, reload }: { activities: Activity[]; reload: () => void }) {
  const [type, setType] = useState<KnownActivityCategory>('CLASE');
  const [tab, setTab] = useState<'active' | 'cancelled'>('active');
  const [editing, setEditing] = useState<Activity | null | undefined>(undefined);
  const [form, setForm] = useState<Form>(() => blank('CLASE'));
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { confirm, confirmDialog } = useConfirm();
  const [order, setOrder] = useState<Activity[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const copy = TYPE_COPY[type];
  const byOrder = (first: Activity, second: Activity) =>
    (first.orden ?? 0) - (second.orden ?? 0) || first.nombre.localeCompare(second.nombre, 'es');
  const isActive = (activity: Activity) => activity.estado === 'ACTIVO';
  const allActive = activities.filter(isActive).sort(byOrder);
  const active = allActive.filter((activity) => typeOf(activity) === type);
  const cancelled = activities.filter((activity) => !isActive(activity) && typeOf(activity) === type).sort(byOrder);
  const countOf = (value: KnownActivityCategory) => activities.filter((activity) => isActive(activity) && typeOf(activity) === value).length;
  const sortable = tab === 'active';
  const list = tab === 'active' ? (sortable && order ? order : active) : cancelled;

  function selectType(value: KnownActivityCategory) {
    setType(value);
    setOrder(null);
    setDragId(null);
  }
  function open(activity?: Activity) {
    setEditing(activity ?? null);
    setForm(fromActivity(type, activity));
    setImage(null);
    setError('');
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('La imagen debe ser JPG, PNG o WebP y pesar hasta 5 MB.');
      event.target.value = '';
      return;
    }
    setImage(file);
    setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing === undefined) return;
    if (form.visible_landing && !image && !editing?.imagenes?.length) return setError(`Una ${TYPE_COPY[form.categoria].singular} que se muestra en la web necesita una imagen.`);
    setBusy(true);
    setError('');
    const data = new FormData();
    data.append('categoria', form.categoria);
    if (!editing) data.append('orden', String(Math.max(-1, ...activities.map((activity) => activity.orden ?? 0)) + 1));
    data.append('nombre', form.nombre);
    data.append('subtitulo', form.subtitulo);
    data.append('descripcion_corta', form.descripcion_corta);
    data.append('requiere_reserva', String(form.requiere_reserva));
    data.append('visible_landing', String(form.visible_landing));
    if (image) data.append('imagen', image);
    try {
      await apiRequest(editing ? `/actividad/${editing.id}` : '/actividad', { method: editing ? 'PATCH' : 'POST', authenticated: true, body: data });
      /* Si se cambio el tipo desde el formulario, se abre la pestaña donde quedo guardada. */
      if (form.categoria !== type) selectType(form.categoria);
      setEditing(undefined);
      reload();
    } catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); }
  }
  async function persistOrder(next: Activity[]) {
    setOrder(next);
    setSavingOrder(true);
    setError('');
    /*
     * El servidor numera de 0 a n-1 las actividades que recibe, asi que se manda
     * la lista completa de activas: se reemplazan solo las posiciones del tipo
     * que se reordeno y las demas conservan su lugar.
     */
    const queue = [...next];
    const complete = allActive.map((activity) => (typeOf(activity) === type ? queue.shift() || activity : activity));
    try {
      await apiRequest('/actividad/orden', { method: 'PUT', authenticated: true, body: { orden: complete.map((activity) => activity.id) } });
      setOrder(null);
      reload();
    } catch (reason) {
      setOrder(null);
      setError(getErrorMessage(reason));
    } finally {
      setSavingOrder(false);
    }
  }

  function moveTo(sourceId: string, targetId: string) {
    const current = order ?? active;
    const from = current.findIndex((activity) => activity.id === sourceId);
    const to = current.findIndex((activity) => activity.id === targetId);
    if (from < 0 || to < 0 || from === to) return null;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    if (!moved) return null;
    next.splice(to, 0, moved);
    return next;
  }

  function shift(index: number, delta: number) {
    const current = order ?? active;
    const target = current[index + delta];
    const source = current[index];
    if (!target || !source || savingOrder) return;
    const next = moveTo(source.id, target.id);
    if (next) void persistOrder(next);
  }

  async function annul(activity: Activity) {
    const accepted = await confirm({
      title: `¿Anular “${activity.nombre}”?`,
      description: 'Dejará de aparecer en la agenda y en la web. Las reservas ya hechas se conservan.',
      confirmLabel: 'Anular',
      tone: 'danger',
    });
    if (!accepted) return;
    try { await apiRequest(`/actividad/${activity.id}`, { method: 'DELETE', authenticated: true }); reload(); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }

  return <section className="activity-manager">
    <header className="staff-manager__header"><button className="button button-dark" type="button" onClick={() => open()}>+ Nueva {copy.singular}</button></header>
    {error && <p className="staff-error" role="alert">{error}</p>}
    <div className="activity-type-tabs" role="tablist" aria-label="Tipo de disciplina">{TYPE_ORDER.map((value) => <button
      key={value}
      type="button"
      role="tab"
      aria-selected={value === type}
      className={value === type ? 'is-active' : ''}
      onClick={() => selectType(value)}
    >{TYPE_COPY[value].plural} <span>{countOf(value)}</span></button>)}</div>
    <div className="staff-tabs" role="tablist"><button type="button" className={tab === 'active' ? 'is-active' : ''} onClick={() => { setTab('active'); setOrder(null); }}>Activas <span>{active.length}</span></button><button type="button" className={tab === 'cancelled' ? 'is-active' : ''} onClick={() => { setTab('cancelled'); setOrder(null); }}>Anuladas <span>{cancelled.length}</span></button></div>
    {savingOrder && <p className="activity-order-hint" role="status">Guardando el orden…</p>}
    <div className={sortable ? 'activity-list activity-list--sortable' : 'activity-list'}>{list.length ? list.map((activity, index) => <article
      key={activity.id}
      className={dragId === activity.id ? 'is-dragging' : undefined}
      draggable={sortable && !savingOrder}
      onDragStart={sortable ? (event) => { setDragId(activity.id); event.dataTransfer.effectAllowed = 'move'; } : undefined}
      onDragOver={sortable ? (event) => {
        event.preventDefault();
        if (!dragId || dragId === activity.id) return;
        const next = moveTo(dragId, activity.id);
        if (next) setOrder(next);
      } : undefined}
      onDrop={sortable ? (event) => { event.preventDefault(); setDragId(null); if (order) void persistOrder(order); } : undefined}
      onDragEnd={sortable ? () => setDragId(null) : undefined}
    >
      {sortable && <span className="activity-list__handle" aria-hidden="true" title="Arrastrar para reordenar">⠿</span>}
      <ActivityThumbnail activity={activity} />
      <div><h3>{activity.nombre}</h3><p>{activity.descripcion_corta || activity.subtitulo || 'Sin descripción breve'}</p><small>{getCategoryLabel(activity.categoria)} · {activity.visible_landing ? 'Se muestra en la web' : 'No se muestra en la web'}</small></div>
      {sortable && <div className="activity-list__move"><button type="button" disabled={index === 0 || savingOrder} aria-label={`Subir ${activity.nombre}`} onClick={() => shift(index, -1)}>↑</button><button type="button" disabled={index === list.length - 1 || savingOrder} aria-label={`Bajar ${activity.nombre}`} onClick={() => shift(index, 1)}>↓</button></div>}
      {tab === 'active' ? <nav><button type="button" onClick={() => open(activity)}>Editar</button><button type="button" className="activity-list__danger" onClick={() => void annul(activity)}>Anular</button></nav> : <small>Anulada</small>}
    </article>) : <p className="staff-empty">No hay {copy.plural.toLocaleLowerCase('es')} {tab === 'active' ? 'activas' : 'anuladas'}.</p>}</div>
    {editing !== undefined && typeof document !== 'undefined' && createPortal(<div className="staff-modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditing(undefined); }}>
      <form className="membership-modal" onSubmit={submit}>
        <header><div><span>{editing ? 'EDITAR' : 'NUEVA'} {TYPE_COPY[form.categoria].singular.toLocaleUpperCase('es')}</span><h2>{editing?.nombre || `Nueva ${TYPE_COPY[form.categoria].singular}`}</h2></div><button type="button" onClick={() => setEditing(undefined)}>×</button></header>
        <div className="membership-modal__body">
          <div className="membership-form-grid"><label>Tipo<select value={form.categoria} onChange={(event) => change('categoria', event.target.value as KnownActivityCategory)}>{TYPE_ORDER.map((value) => <option key={value} value={value}>{getCategoryLabel(value)}</option>)}</select></label><label>Nombre<input required placeholder="Ej.: Hot Pilates" value={form.nombre} onChange={(event) => change('nombre', event.target.value)} /></label></div>
          <label>Subtítulo<input placeholder="Ej.: Entrenamiento de fuerza y calor" value={form.subtitulo} onChange={(event) => change('subtitulo', event.target.value)} /></label>
          <label>Descripción breve<input placeholder={`Contá en una línea de qué se trata la ${TYPE_COPY[form.categoria].singular}`} value={form.descripcion_corta} onChange={(event) => change('descripcion_corta', event.target.value)} /></label>
          <div className="membership-checks"><label><input type="checkbox" checked={form.requiere_reserva} onChange={(event) => change('requiere_reserva', event.target.checked)} /> Requiere reserva</label><label><input type="checkbox" checked={form.visible_landing} onChange={(event) => change('visible_landing', event.target.checked)} /> Se muestra en la web</label></div>
          {form.visible_landing && <label className="activity-landing-image">Imagen para la web<input required={!editing?.imagenes?.length} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><small>{image ? image.name : editing?.imagenes?.length ? 'Podés reemplazar la imagen actual.' : 'JPG, PNG o WebP · máximo 5 MB.'}</small></label>}
          {error && <p className="staff-error">{error}</p>}
        </div>
        <footer><button type="button" className="text-link" onClick={() => setEditing(undefined)}>Cancelar</button><button className="button button-dark" disabled={busy}>{busy ? 'Guardando…' : `Guardar ${TYPE_COPY[form.categoria].singular}`}</button></footer>
      </form>
    </div>, document.body)}
    {confirmDialog}
  </section>;
}
