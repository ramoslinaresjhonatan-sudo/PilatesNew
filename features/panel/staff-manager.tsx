'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirm } from '@/components/confirm-dialog';
import { CopyButton, CopyField } from '@/components/copy-button';
import { ResilientImage } from '@/components/resilient-image';
import { apiRequest, getErrorMessage } from '@/lib/http-client';
import { safeAssetUrl } from '@/lib/api';
import type { Activity, StaffMember, StaffRole } from '@/lib/types';
import { getFullName } from '@/lib/format';
import { studioDateKey } from '@/lib/studio-time';

const COACH_ROLE = 'COACH';

type StaffForm = {
  rol: string; nombre: string; apellido_paterno: string; apellido_materno: string;
  correo: string; telefono: string; fecha_nacimiento: string; presentacion: string; biografia: string;
  visible_landing: boolean; actividad_ids: string[]; fotos: File[];
};

const initialForm: StaffForm = {
  rol: '', nombre: '', apellido_paterno: '', apellido_materno: '', correo: '', telefono: '',
  fecha_nacimiento: '', presentacion: '', biografia: '', visible_landing: true, actividad_ids: [], fotos: [],
};

function roleLabel(code: string) {
  return code
    .toLocaleLowerCase('es')
    .replace(/_+/g, ' ')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'));
}

function formFromMember(member: StaffMember): StaffForm {
  return {
    rol: member.rol || (member.tipo === 'COACH' ? COACH_ROLE : ''),
    nombre: member.usuario.nombre,
    apellido_paterno: member.usuario.apellido_paterno || '',
    apellido_materno: member.usuario.apellido_materno || '',
    correo: member.usuario.correo || '',
    telefono: member.usuario.telefono || '',
    fecha_nacimiento: member.fecha_nacimiento || '',
    presentacion: member.presentacion || '',
    biografia: member.biografia || '',
    visible_landing: Boolean(member.visible_landing),
    actividad_ids: member.actividades.map((activity) => activity.id),
    fotos: [],
  };
}

function memberRoleCodes(member: StaffMember) {
  return member.roles?.length ? member.roles.map((role) => role.nombre) : [member.rol || member.tipo];
}

function normalizeFilterValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim();
}

function MemberRoles({ member }: { member: StaffMember }) {
  const codes = memberRoleCodes(member);
  return <>{codes.map((code) => <small className="staff-role-tag" key={code}>{roleLabel(code)}</small>)}</>;
}

function MemberAvatar({ member }: { member: StaffMember }) {
  const image = member.tipo === 'COACH' ? member.imagenes[0] : undefined;
  const source = safeAssetUrl(image?.url, '', image?.id);
  const fullName = getFullName(member.usuario);

  return <span className="list-avatar">
    {source
      ? <ResilientImage src={source} alt={image?.texto_alt || `Foto de ${fullName}`} />
      : <span aria-hidden="true">{member.usuario.nombre[0]}</span>}
  </span>;
}

export function StaffManager({ staff, activities, roles, rolesLoading, reload }: {
  staff: StaffMember[];
  activities: Activity[];
  roles: StaffRole[];
  rolesLoading: boolean;
  reload: () => void;
}) {
  const [form, setForm] = useState<StaffForm>(initialForm);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'active' | 'cancelled'>('active');
  const [nameFilter, setNameFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [credentials, setCredentials] = useState<{ correo: string; contrasena_temporal: string } | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const { confirm, confirmDialog } = useConfirm();
  const today = studioDateKey(new Date());
  const active = staff.filter((item) => item.estado === 'ACTIVO');
  const cancelled = staff.filter((item) => item.estado !== 'ACTIVO');
  const availableRoles = useMemo(() => {
    const codes = new Set([...roles.map((role) => role.nombre), ...staff.flatMap(memberRoleCodes)]);
    return [...codes].sort((left, right) => roleLabel(left).localeCompare(roleLabel(right), 'es'));
  }, [roles, staff]);
  const normalizedNameFilter = normalizeFilterValue(nameFilter);
  const matchesFilters = (member: StaffMember) => {
    const matchesName = !normalizedNameFilter || normalizeFilterValue(getFullName(member.usuario)).includes(normalizedNameFilter);
    const matchesRole = !roleFilter || memberRoleCodes(member).includes(roleFilter);
    return matchesName && matchesRole;
  };
  const filteredActive = active.filter(matchesFilters);
  const filteredCancelled = cancelled.filter(matchesFilters);
  const filtersApplied = Boolean(normalizedNameFilter || roleFilter);
  // Al editar manda el perfil ya existente; al crear, el rol elegido en el formulario.
  const coach = editing ? editing.tipo === 'COACH' : form.rol === COACH_ROLE;
  const existingPhoto = editing?.tipo === 'COACH' ? editing.imagenes[0] : undefined;
  const existingPhotoUrl = safeAssetUrl(existingPhoto?.url, '', existingPhoto?.id);
  const displayedPhotoUrl = photoPreviewUrl || existingPhotoUrl;

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  const change = <K extends keyof StaffForm>(key: K, value: StaffForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  function resetPhotoSelection() {
    change('fotos', []);
    setPhotoPreviewUrl('');
  }
  function closeForm() {
    setFormOpen(false);
    setPhotoPreviewUrl('');
  }
  function openCreate() { setEditing(null); setForm({ ...initialForm, rol: roles[0]?.nombre || '' }); setPhotoPreviewUrl(''); setError(''); setFormOpen(true); }
  function openEdit(member: StaffMember) { setEditing(member); setForm(formFromMember(member)); setPhotoPreviewUrl(''); setError(''); setFormOpen(true); }
  function selectRole(role: string) {
    change('rol', role);
    if (role !== COACH_ROLE) resetPhotoSelection();
  }
  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    change('fotos', photo ? [photo] : []);
    setPhotoPreviewUrl(photo ? URL.createObjectURL(photo) : '');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!editing && !form.rol) return setError('Seleccioná el rol del integrante.');
    if (form.fecha_nacimiento && form.fecha_nacimiento > today) return setError('La fecha de nacimiento no puede ser futura.');
    if (coach && !form.fecha_nacimiento) return setError('El coach necesita una fecha de nacimiento.');
    if (coach && form.actividad_ids.length < 1) return setError('El coach necesita al menos una especialidad.');
    if (coach && !existingPhoto && form.fotos.length < 1) return setError('El coach necesita una foto de perfil.');
    setBusy(true);
    try {
      if (editing) {
        await apiRequest(`/personal/${editing.usuario_id}`, {
          method: 'PATCH', authenticated: true,
          body: {
            nombre: form.nombre,
            apellido_paterno: form.apellido_paterno.trim() || null,
            apellido_materno: form.apellido_materno.trim() || null,
            telefono: form.telefono.trim() || null,
            ...(coach ? {
              ...(form.fecha_nacimiento ? { fecha_nacimiento: form.fecha_nacimiento } : {}),
              presentacion: form.presentacion,
              biografia: form.biografia.trim() || null,
              visible_landing: form.visible_landing,
              actividad_ids: form.actividad_ids,
            } : {}),
          },
        });
        const replacementPhoto = form.fotos[0];
        if (coach && replacementPhoto) {
          const data = new FormData();
          data.append('foto', replacementPhoto);
          await apiRequest(
            existingPhoto ? `/coach/${editing.id}/imagen/${existingPhoto.id}` : `/coach/${editing.id}/imagen`,
            { method: existingPhoto ? 'PATCH' : 'POST', body: data, authenticated: true },
          );
        }
      } else {
        const data = new FormData();
        data.append('rol', form.rol);
        data.append('nombre', form.nombre.trim());
        data.append('apellido_paterno', form.apellido_paterno.trim());
        // Solo se envían los campos con contenido: un valor vacío hacía fallar la
        // validación del backend en las altas que no son de coach.
        if (form.apellido_materno.trim()) data.append('apellido_materno', form.apellido_materno.trim());
        data.append('correo', form.correo.trim());
        if (form.telefono.trim()) data.append('telefono', form.telefono.trim());
        if (coach) {
          if (form.fecha_nacimiento) data.append('fecha_nacimiento', form.fecha_nacimiento);
          if (form.presentacion.trim()) data.append('presentacion', form.presentacion.trim());
          if (form.biografia.trim()) data.append('biografia', form.biografia.trim());
          data.append('visible_landing', String(form.visible_landing));
          data.append('actividad_ids', JSON.stringify(form.actividad_ids));
          form.fotos.forEach((file) => data.append('fotos', file));
        }
        const response = await apiRequest<{ credenciales: { correo: string; contrasena_temporal: string } }>('/personal', { method: 'POST', body: data, authenticated: true });
        setCredentials(response.credenciales);
      }
      setForm(initialForm);
      setEditing(null);
      closeForm();
      reload();
    } catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); }
  }

  async function removePhoto(member: StaffMember, imageId: string) {
    if (member.imagenes.length <= 1) return;
    const accepted = await confirm({
      title: '¿Quitar esta foto?',
      description: `Se eliminará del perfil de ${getFullName(member.usuario)} y del almacenamiento. No se puede deshacer.`,
      confirmLabel: 'Quitar foto',
      tone: 'danger',
    });
    if (!accepted) return;
    try { await apiRequest(`/coach/${member.id}/imagen/${imageId}`, { method: 'DELETE', authenticated: true }); reload(); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }
  async function cancel(member: StaffMember) {
    const accepted = await confirm({
      title: `¿Anular a ${getFullName(member.usuario)}?`,
      description: 'Ya no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Queda en la pestaña Anulados y podés restablecerlo cuando quieras.',
      confirmLabel: 'Anular integrante',
      tone: 'danger',
    });
    if (!accepted) return;
    setError('');
    try { await apiRequest(`/personal/${member.usuario_id}`, { method: 'DELETE', authenticated: true }); reload(); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }
  async function restore(member: StaffMember) {
    setError('');
    try { await apiRequest(`/personal/${member.usuario_id}/reactivar`, { method: 'POST', authenticated: true }); reload(); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }

  return <section className="staff-manager">
    <header className="staff-manager__header"><div><h2>Equipo</h2><p>Administra los integrantes del estudio y el rol con el que ingresan al sistema.</p></div><button className="button button-dark" type="button" onClick={openCreate} disabled={rolesLoading || roles.length === 0}>+ Nuevo integrante</button></header>
    {error && !formOpen && <p className="staff-error" role="alert">{error}</p>}
    {!rolesLoading && roles.length === 0 && <p className="staff-error" role="alert">No hay roles disponibles para asignar. Creá uno en el módulo de Roles y permisos.</p>}
    {formOpen && typeof document !== 'undefined' && createPortal(<div className="staff-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeForm(); }}>
      <form className="staff-form staff-modal panel-editor-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="staff-form-title">
        <header><div><h2 id="staff-form-title">{editing ? 'Editar integrante' : 'Nuevo integrante'}</h2><p>{editing ? 'Los campos vienen cargados con los datos actuales.' : 'La contraseña temporal se mostrará una sola vez al terminar.'}</p></div><button className="staff-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={closeForm}>×</button></header>
        <div className="staff-form__body">
          {editing
            ? <p className="staff-role-readonly"><span>Rol asignado</span><strong>{roleLabel(form.rol || editing.tipo)}</strong><small>Para cambiarlo, anulá el integrante y creá uno nuevo.</small></p>
            : <label>Rol<select required value={form.rol} onChange={(event) => selectRole(event.target.value)}><option value="" disabled>Seleccioná un rol</option>{roles.map((role) => <option value={role.nombre} key={role.id}>{roleLabel(role.nombre)}</option>)}</select><small>{coach ? 'Un coach necesita fecha de nacimiento, presentación, especialidad y una foto.' : 'Solo los coaches pueden adjuntar una foto de perfil.'}</small></label>}
          <div className="staff-form__grid"><label>Nombre<input required placeholder="Ej.: Daniela" value={form.nombre} onChange={(event) => change('nombre', event.target.value)} /></label><label>Apellido paterno<input required={!editing} placeholder="Ej.: Martínez" value={form.apellido_paterno} onChange={(event) => change('apellido_paterno', event.target.value)} /></label><label>Apellido materno<input placeholder="Ej.: Rojas (opcional)" value={form.apellido_materno} onChange={(event) => change('apellido_materno', event.target.value)} /></label><label>Correo<input required disabled={Boolean(editing)} type="email" placeholder="Ej.: daniela@pilateshouse.com" value={form.correo} onChange={(event) => change('correo', event.target.value)} /></label><label>Teléfono<input type="tel" placeholder="Ej.: +591 70000000" value={form.telefono} onChange={(event) => change('telefono', event.target.value)} /></label>{coach && <label>Fecha de nacimiento<input required={!editing} type="date" max={today} value={form.fecha_nacimiento} onChange={(event) => change('fecha_nacimiento', event.target.value)} /></label>}</div>
          {coach && <>
            <section className="staff-photo-editor" aria-labelledby="staff-photo-title">
              <span className="staff-photo-editor__preview">
                {displayedPhotoUrl
                  ? <ResilientImage src={displayedPhotoUrl} alt={`Foto de ${form.nombre || 'coach'}`} />
                  : <span aria-hidden="true">{form.nombre.trim()[0] || 'C'}</span>}
              </span>
              <label><span id="staff-photo-title">Foto de perfil</span><input required={!existingPhoto} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} /><small>{editing && existingPhoto ? 'Seleccioná otra imagen para reemplazar la actual. Al guardar, la anterior se elimina.' : 'Seleccioná una imagen JPG, PNG o WebP de hasta 5 MB.'}</small></label>
            </section>
            <label>Presentación<textarea required minLength={10} placeholder="Ej.: Coach especializada en Hot Pilates y movilidad." value={form.presentacion} onChange={(event) => change('presentacion', event.target.value)} /></label>
            <label>Biografía<textarea placeholder="Ej.: Formación, experiencia y enfoque de trabajo." value={form.biografia} onChange={(event) => change('biografia', event.target.value)} /></label>
            <label className="staff-check"><input type="checkbox" checked={form.visible_landing} onChange={(event) => change('visible_landing', event.target.checked)} /> Se muestra en la web</label>
            <fieldset><legend>Especialidades</legend>{activities.filter((activity) => activity.estado === 'ACTIVO').map((activity) => <label className="staff-check" key={activity.id}><input type="checkbox" checked={form.actividad_ids.includes(activity.id)} onChange={(event) => change('actividad_ids', event.target.checked ? [...form.actividad_ids, activity.id] : form.actividad_ids.filter((id) => id !== activity.id))} />{activity.nombre}</label>)}</fieldset>
          </>}
          {error && <p className="staff-error" role="alert">{error}</p>}
        </div>
        <footer><button className="text-link" type="button" disabled={busy} onClick={closeForm}>Cancelar</button><button className="button button-dark" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear integrante'}</button></footer>
      </form>
    </div>, document.body)}
    {credentials && <div className="staff-credentials" role="dialog" aria-modal="true"><div><h2>Datos para entregar</h2><p>Copialos ahora y envíalos por privado. No volverán a mostrarse.</p><CopyField label="Usuario" value={credentials.correo} /><CopyField label="Contraseña temporal" value={credentials.contrasena_temporal} /><CopyButton value={`Usuario: ${credentials.correo}
Contraseña temporal: ${credentials.contrasena_temporal}`} label="Copiar los dos" copiedLabel="Datos copiados" /><button className="button button-dark" type="button" onClick={() => setCredentials(null)}>Entendido</button></div></div>}
    <div className="staff-tabs" role="tablist" aria-label="Estado del equipo"><button type="button" role="tab" aria-selected={selectedTab === 'active'} className={selectedTab === 'active' ? 'is-active' : ''} onClick={() => setSelectedTab('active')}>Activos <span>{active.length}</span></button><button type="button" role="tab" aria-selected={selectedTab === 'cancelled'} className={selectedTab === 'cancelled' ? 'is-active' : ''} onClick={() => setSelectedTab('cancelled')}>Anulados <span>{cancelled.length}</span></button></div>
    <div className="staff-directory-toolbar" role="search" aria-label="Filtros de personal">
      <div className="staff-directory-toolbar__fields">
        <label><span>Buscar integrante</span><input type="search" value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Nombre o apellido" /></label>
        <label><span>Rol</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">Todos los roles</option>{availableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
      </div>
      {filtersApplied && <div className="staff-directory-toolbar__meta"><button type="button" onClick={() => { setNameFilter(''); setRoleFilter(''); }}>Limpiar filtros</button></div>}
    </div>
    {selectedTab === 'active'
      ? <div className="management-list">{filteredActive.length ? filteredActive.map((member) => <article key={member.usuario_id} className="staff-member-row"><MemberAvatar member={member} /><div><h3>{getFullName(member.usuario)} <MemberRoles member={member} /></h3><p>{member.usuario.correo} {member.presentacion ? `— ${member.presentacion}` : ''}</p>{member.tipo === 'COACH' && <div className="staff-photo-strip">{member.imagenes.map((image) => { const source = safeAssetUrl(image.url, '', image.id); return <span key={image.id}>{source && <ResilientImage src={source} alt={image.texto_alt || `Foto de ${getFullName(member.usuario)}`} />}<button type="button" disabled={member.imagenes.length <= 1} aria-label="Quitar foto" onClick={() => void removePhoto(member, image.id)}>×</button></span>; })}</div>}</div><nav><button className="text-link" type="button" onClick={() => openEdit(member)}>Editar</button><button className="text-link" type="button" onClick={() => void cancel(member)}>Anular</button></nav></article>) : <p className="staff-empty">{filtersApplied ? 'No hay integrantes que coincidan con los filtros.' : 'No hay integrantes activos.'}</p>}</div>
      : <div className="management-list">{filteredCancelled.length ? filteredCancelled.map((member) => <article key={member.usuario_id} className="staff-member-row"><MemberAvatar member={member} /><div><h3>{getFullName(member.usuario)} <MemberRoles member={member} /></h3><p>{member.usuario.correo}</p></div><nav><button className="text-link" type="button" onClick={() => void restore(member)}>Restablecer</button></nav></article>) : <p className="staff-empty">{filtersApplied ? 'No hay integrantes que coincidan con los filtros.' : 'Sin registros anulados.'}</p>}</div>}
    {confirmDialog}
  </section>;
}
