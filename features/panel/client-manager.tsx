'use client';

import { usePanelProfile } from '@/components/panel-profile-context';
import { ClientMembershipCheckout } from './client-membership-checkout';
import { ClientMembershipClasses } from './client-membership-classes';
import { useApiResource } from '@/hooks/use-api-resource';
import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirm } from '@/components/confirm-dialog';
import { CopyButton, CopyField } from '@/components/copy-button';
import { ResilientImage } from '@/components/resilient-image';
import { StatusState } from '@/components/status-state';
import { invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { formatDateTime, getFullName } from '@/lib/format';
import { studioDateKey } from '@/lib/studio-time';
import type { ClientDirectoryEntry, PaginatedClients, MembershipPlan } from '@/lib/types';

export type ClientListStatus = 'ACTIVOS' | 'INACTIVOS' | 'TODOS';
export type ClientLegacyStatus = 'PENDIENTE' | 'CARGADO' | 'TODOS';

type ClientResource = {
  data: PaginatedClients | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
};

const LEGACY_STATUS_LABELS: Record<ClientLegacyStatus, string> = {
  PENDIENTE: 'Pendientes de cargar en sistema antiguo',
  CARGADO: 'Clientes cargados',
  TODOS: 'Todos',
};

type ClientForm = {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  telefono: string;
  fecha_nacimiento: string;
};

const STATUS_LABELS: Record<ClientListStatus, string> = {
  ACTIVOS: 'Activos',
  INACTIVOS: 'Dados de baja',
  TODOS: 'Todos',
};

const blankForm = (): ClientForm => ({
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  correo: '',
  telefono: '',
  fecha_nacimiento: '',
});

type FieldErrors = Partial<Record<keyof ClientForm, string>>;

const PHONE_PATTERN = /^[+\d][\d\s()-]*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mismas reglas que valida el servidor, para avisar antes de enviar. */
function validateClient(form: ClientForm, today: string): FieldErrors {
  const errors: FieldErrors = {};
  const nombre = form.nombre.trim();
  const paterno = form.apellido_paterno.trim();
  const correo = form.correo.trim();
  const telefono = form.telefono.trim();
  const nacimiento = form.fecha_nacimiento.trim();

  if (!nombre) errors.nombre = 'Ingresá el nombre.';
  else if (nombre.length < 2) errors.nombre = 'El nombre necesita al menos 2 caracteres.';

  if (!paterno) errors.apellido_paterno = 'Ingresá el apellido paterno.';
  else if (paterno.length < 2) errors.apellido_paterno = 'El apellido necesita al menos 2 caracteres.';

  if (!correo) errors.correo = 'Ingresá el correo.';
  else if (!EMAIL_PATTERN.test(correo)) errors.correo = 'Ingresá un correo válido.';

  if (!telefono) errors.telefono = 'Ingresá el teléfono.';
  else if (telefono.replace(/\D/g, '').length < 7) errors.telefono = 'El teléfono necesita al menos 7 dígitos.';
  else if (!PHONE_PATTERN.test(telefono)) errors.telefono = 'Solo se admiten números, espacios, guiones y paréntesis.';

  if (!nacimiento) errors.fecha_nacimiento = 'Ingresá la fecha de nacimiento.';
  else if (nacimiento > today) errors.fecha_nacimiento = 'La fecha de nacimiento no puede ser futura.';

  return errors;
}

function ClientAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="client-directory__avatar">
      {photoUrl && !imageFailed
        ? <ResilientImage src={photoUrl} alt={`Foto de ${name}`} onError={() => setImageFailed(true)} />
        : <span aria-hidden="true">{initial}</span>}
    </div>
  );
}

export function ClientManager({
  resource,
  search,
  onSearch,
  status,
  onStatus,
  migrationResource,
  legacyStatus,
  onLegacyStatus,
  legacyFrom,
  onLegacyFrom,
  legacyTo,
  onLegacyTo,
}: {
  resource: ClientResource;
  search: string;
  onSearch: (value: string) => void;
  status: ClientListStatus;
  onStatus: (value: ClientListStatus) => void;
  migrationResource: ClientResource;
  legacyStatus: ClientLegacyStatus;
  onLegacyStatus: (value: ClientLegacyStatus) => void;
  legacyFrom: string;
  onLegacyFrom: (value: string) => void;
  legacyTo: string;
  onLegacyTo: (value: string) => void;
}) {
  const profile = usePanelProfile();
  const canCharge = Boolean(profile.data?.roles.includes('ADMINISTRADOR') || profile.data?.permisos.includes('payments.manage'));
  const canAddClasses = Boolean(profile.data?.roles.includes('ADMINISTRADOR') || profile.data?.permisos.includes('memberships.manage'));
  const [classAdjustment, setClassAdjustment] = useState<{ userId: string; clientName: string } | null>(null);
  const plans = useApiResource<MembershipPlan[]>(canCharge ? '/cliente/planes-venta' : null, true);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [checkout, setCheckout] = useState<{ userId: string; planId: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [credentials, setCredentials] = useState<{ correo: string; contrasena_temporal: string } | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const [tab, setTab] = useState<'directorio' | 'migracion'>('directorio');
  const [legacyResponsible, setLegacyResponsible] = useState('');
  const [legacyBusyId, setLegacyBusyId] = useState<string | null>(null);
  const [legacyError, setLegacyError] = useState('');
  const clients = resource.data?.datos || [];
  const total = resource.data?.paginacion.total ?? 0;
  const today = studioDateKey(new Date());
  const legacyClients = migrationResource.data?.datos || [];
  const legacyCounters = migrationResource.data?.resumen_migracion ?? { pendientes: 0, cargados: 0 };
  const legacyResponsibleFilter = legacyResponsible.trim().toLocaleLowerCase('es');
  const filteredLegacyClients = legacyResponsibleFilter
    ? legacyClients.filter((client) => (client.confirmacion_sistema_antiguo?.usuario?.nombre || '').toLocaleLowerCase('es').includes(legacyResponsibleFilter))
    : legacyClients;

  const refreshMigration = () => invalidateApiResourcesByPath('/cliente');

  async function confirmLegacyRegistration(client: ClientDirectoryEntry) {
    const name = getFullName(client);
    const accepted = await confirm({
      title: `¿Marcar a ${name} como cargado en el sistema antiguo?`,
      description: 'Se guardará la fecha, hora y el usuario que confirma este registro.',
      confirmLabel: 'Confirmar carga',
    });
    if (!accepted) return;
    setLegacyError('');
    setLegacyBusyId(client.id);
    try {
      await apiRequest(`/cliente/${client.id}/sistema-antiguo/confirmar`, { method: 'POST', authenticated: true });
      refreshMigration();
    } catch (reason) {
      setLegacyError(getErrorMessage(reason));
    } finally {
      setLegacyBusyId(null);
    }
  }

  async function revertLegacyRegistration(client: ClientDirectoryEntry) {
    const name = getFullName(client);
    const accepted = await confirm({
      title: `¿Volver a marcar a ${name} como pendiente?`,
      description: 'El cliente volverá a la lista de pendientes de cargar en el sistema antiguo.',
      tone: 'danger',
    });
    if (!accepted) return;
    setLegacyError('');
    setLegacyBusyId(client.id);
    try {
      await apiRequest(`/cliente/${client.id}/sistema-antiguo/revertir`, { method: 'POST', authenticated: true });
      refreshMigration();
    } catch (reason) {
      setLegacyError(getErrorMessage(reason));
    } finally {
      setLegacyBusyId(null);
    }
  }

  /**
   * Cada filtro y cada busqueda se guardan por separado. Al dar de baja o
   * reactivar hay que refrescar todas las vistas, no solo la que esta abierta:
   * si no, el cliente reactivado no reaparecia en la lista de Activos.
   */
  const refreshList = () => invalidateApiResourcesByPath('/cliente');

  const change = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  function openCreate() {
    setForm(blankForm());
    setSelectedPlan('');
    setError('');
    setFieldErrors({});
    setFormOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors = validateClient(form, today);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Revisá los campos marcados antes de continuar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await apiRequest<{ usuario: { id: string }; credenciales: { correo: string; contrasena_temporal: string } }>('/cliente', {
        method: 'POST',
        authenticated: true,
        body: {
          nombre: form.nombre.trim(),
          apellido_paterno: form.apellido_paterno.trim(),
          apellido_materno: form.apellido_materno.trim() || null,
          correo: form.correo.trim(),
          telefono: form.telefono.trim(),
          fecha_nacimiento: form.fecha_nacimiento,
        },
      });
      setCredentials(response.credenciales);
      if (canCharge && selectedPlan) setCheckout({ userId: response.usuario.id, planId: selectedPlan });
      setFormOpen(false);
      setForm(blankForm());
      refreshList();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(client: ClientDirectoryEntry) {
    const name = getFullName(client);
    const accepted = await confirm({
      title: `¿Dar de baja a ${name}?`,
      description: 'No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Conserva membresías, pagos e historial, y podés reactivarlo cuando quieras.',
      confirmLabel: 'Dar de baja',
      tone: 'danger',
    });
    if (!accepted) return;
    setError('');
    try {
      await apiRequest(`/cliente/${client.id}`, { method: 'DELETE', authenticated: true });
      refreshList();
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  async function reactivate(client: ClientDirectoryEntry) {
    setError('');
    try {
      await apiRequest(`/cliente/${client.id}/reactivar`, { method: 'POST', authenticated: true });
      refreshList();
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  return <section className="client-manager">
    <header className="staff-manager__header">
      <div><h2>Clientes</h2></div>
      {tab === 'directorio' && <button className="button button-dark" type="button" onClick={openCreate}>+ Nuevo cliente</button>}
    </header>

    <nav className="client-manager__tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'directorio'} className={tab === 'directorio' ? 'is-active' : ''} onClick={() => setTab('directorio')}>Directorio</button>
      <button type="button" role="tab" aria-selected={tab === 'migracion'} className={tab === 'migracion' ? 'is-active' : ''} onClick={() => setTab('migracion')}>
        Migración al sistema antiguo
        {legacyCounters.pendientes > 0 && <span className="client-manager__tab-badge">{legacyCounters.pendientes}</span>}
      </button>
    </nav>

    {tab === 'directorio' && <>
    {error && <p className="staff-error" role="alert">{error}</p>}

    <div className="client-directory-toolbar">
      <label><span>Buscar clientes</span><input value={search} onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Nombre, apellido o correo" autoComplete="off" /></label>
      <label className="client-directory-toolbar__status"><span>Estado</span><select value={status} onChange={(event) => onStatus(event.target.value as ClientListStatus)}>{(Object.keys(STATUS_LABELS) as ClientListStatus[]).map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
      <small>{resource.loading ? 'Buscando…' : `${total} ${STATUS_LABELS[status].toLocaleLowerCase('es')}`}</small>
    </div>

    {resource.loading && <StatusState kind="loading" title="Cargando clientes" description="Un momento, estamos buscando los clientes." />}
    {resource.error && <StatusState kind="error" title="No pudimos cargar los clientes" description={resource.error} actionLabel="Reintentar" onAction={resource.retry} />}
    {!resource.loading && !resource.error && clients.length === 0 && <StatusState title={search ? 'Sin coincidencias' : 'Sin clientes registrados'} description={search ? 'Probá con otro nombre, apellido o correo.' : 'Cuando registres clientes van a aparecer acá.'} />}

    {!resource.loading && !resource.error && clients.length > 0 && <div className="client-directory">{clients.map((client) => {
      const fullName = getFullName(client);
      const isActive = client.estado === 'ACTIVO';
      const membership = client.membresia_actual;
      return <article key={client.id}>
        <ClientAvatar name={fullName} photoUrl={client.foto_url} />
        <div className="client-directory__identity">
          <h3>{fullName}</h3>
          <p>{client.correo}</p>
          <small>{client.telefono || 'Sin teléfono registrado'}</small>
          {membership ? <div className="client-directory__membership">
            <strong>{membership.nombre_plan}</strong>
            <span>Membresía {membership.estado.toLocaleLowerCase('es')}</span>
            <span>Vigencia: {formatDateTime(membership.fecha_inicio, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} — {formatDateTime(membership.fecha_fin, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
            <span>No se puede asignar otra membresía mientras esta siga vigente.</span>
          </div> : <p>Sin membresía vigente</p>}
        </div>
        <div className="client-directory__details">
          <span>{client.edad == null ? 'Edad no registrada' : `${client.edad} años`}</span>
          <small className={isActive ? '' : 'is-inactive'}>{client.estado}</small>
        </div>
        <nav className="client-directory__actions">
          {canCharge && isActive && !membership && <button className="text-link" type="button" onClick={() => setCheckout({ userId: client.usuario_id, planId: '' })}>Asignar membresía</button>}
          {canAddClasses && isActive && membership?.permite_agregar_clases && <button className="text-link" type="button" onClick={() => setClassAdjustment({ userId: client.usuario_id, clientName: fullName })}>Agregar clases</button>}
          {isActive
            ? <button className="text-link" type="button" onClick={() => void deactivate(client)}>Dar de baja</button>
            : <button className="text-link" type="button" onClick={() => void reactivate(client)}>Reactivar</button>}
        </nav>
      </article>;
    })}</div>}
    </>}

    {tab === 'migracion' && <div className="client-migration">
      <div className="client-migration__counters">
        <div className="client-migration__counter"><strong>{legacyCounters.pendientes}</strong><span>Pendientes de cargar en sistema antiguo</span></div>
        <div className="client-migration__counter"><strong>{legacyCounters.cargados}</strong><span>Clientes cargados</span></div>
      </div>

      {legacyError && <p className="staff-error" role="alert">{legacyError}</p>}

      <div className="client-directory-toolbar">
        <label className="client-directory-toolbar__status"><span>Estado</span><select value={legacyStatus} onChange={(event) => onLegacyStatus(event.target.value as ClientLegacyStatus)}>{(Object.keys(LEGACY_STATUS_LABELS) as ClientLegacyStatus[]).map((value) => <option key={value} value={value}>{LEGACY_STATUS_LABELS[value]}</option>)}</select></label>
        <label><span>Confirmado desde</span><input type="date" value={legacyFrom} max={today} onChange={(event) => onLegacyFrom(event.target.value)} /></label>
        <label><span>Confirmado hasta</span><input type="date" value={legacyTo} max={today} onChange={(event) => onLegacyTo(event.target.value)} /></label>
        <label><span>Usuario responsable</span><input type="search" value={legacyResponsible} onChange={(event) => setLegacyResponsible(event.target.value)} placeholder="Nombre de quien confirmó" autoComplete="off" /></label>
        <small>{migrationResource.loading ? 'Buscando…' : `${filteredLegacyClients.length} ${LEGACY_STATUS_LABELS[legacyStatus].toLocaleLowerCase('es')}`}</small>
      </div>

      {migrationResource.loading && <StatusState kind="loading" title="Cargando clientes" description="Consultando el avance de la migración." />}
      {migrationResource.error && <StatusState kind="error" title="No pudimos cargar la migración" description={migrationResource.error} actionLabel="Reintentar" onAction={migrationResource.retry} />}
      {!migrationResource.loading && !migrationResource.error && filteredLegacyClients.length === 0 && <StatusState title="Sin clientes en esta vista" description="Ajustá los filtros o esperá a que se registren nuevos clientes." />}

      {!migrationResource.loading && !migrationResource.error && filteredLegacyClients.length > 0 && <div className="client-directory client-migration__list">{filteredLegacyClients.map((client) => {
        const fullName = getFullName(client);
        const loaded = client.estado_sistema_antiguo === 'CARGADO';
        const confirmation = client.confirmacion_sistema_antiguo;
        return <article key={client.id}>
          <ClientAvatar name={fullName} photoUrl={client.foto_url} />
          <div className="client-directory__identity">
            <h3>{fullName}</h3>
            <p>{client.correo}</p>
            <small>{client.telefono || 'Sin teléfono registrado'}</small>
            <small>{client.fecha_nacimiento ? `Nacimiento: ${formatDateTime(client.fecha_nacimiento, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'Fecha de nacimiento no registrada'}</small>
            <small>Registrado en el sistema nuevo: {formatDateTime(client.fecha_registro, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</small>
          </div>
          <div className="client-directory__details">
            {loaded && confirmation
              ? <small>Cargado el {formatDateTime(confirmation.fecha, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · {formatDateTime(confirmation.fecha, { hour: 'numeric', minute: '2-digit' })}{confirmation.usuario ? ` · ${confirmation.usuario.nombre}` : ''}</small>
              : <small className="is-inactive">Pendiente de cargar en sistema antiguo</small>}
          </div>
          <nav className="client-directory__actions">
            <label className="client-migration__check">
              <input
                type="checkbox"
                checked={loaded}
                disabled={legacyBusyId === client.id}
                onChange={() => void (loaded ? revertLegacyRegistration(client) : confirmLegacyRegistration(client))}
              />
              Registrado en sistema antiguo
            </label>
          </nav>
        </article>;
      })}</div>}
    </div>}

    {formOpen && typeof document !== 'undefined' && createPortal(
      <div className="staff-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setFormOpen(false); }}>
        <form className="membership-modal panel-editor-modal client-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="client-form-title">
          <header>
            <div><span>Clientes</span><h2 id="client-form-title">Nuevo cliente</h2><p>La contraseña temporal se mostrará una sola vez al terminar.</p></div>
            <button className="staff-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={() => setFormOpen(false)}>×</button>
          </header>
          <div className="membership-modal__body">
            <div className="staff-form__grid">
              <label className={fieldErrors.nombre ? 'has-error' : ''}>Nombre<input required minLength={2} maxLength={60} placeholder="Ej.: María" value={form.nombre} aria-invalid={Boolean(fieldErrors.nombre)} onChange={(event) => change('nombre', event.target.value)} />{fieldErrors.nombre && <small className="field-error">{fieldErrors.nombre}</small>}</label>
              <label className={fieldErrors.apellido_paterno ? 'has-error' : ''}>Apellido paterno<input required minLength={2} maxLength={60} placeholder="Ej.: Pérez" value={form.apellido_paterno} aria-invalid={Boolean(fieldErrors.apellido_paterno)} onChange={(event) => change('apellido_paterno', event.target.value)} />{fieldErrors.apellido_paterno && <small className="field-error">{fieldErrors.apellido_paterno}</small>}</label>
              <label>Apellido materno <small className="field-hint">Opcional</small><input maxLength={60} placeholder="Ej.: Gómez" value={form.apellido_materno} onChange={(event) => change('apellido_materno', event.target.value)} /></label>
              <label className={fieldErrors.correo ? 'has-error' : ''}>Correo<input required type="email" maxLength={150} placeholder="Ej.: maria.perez@correo.com" value={form.correo} aria-invalid={Boolean(fieldErrors.correo)} onChange={(event) => change('correo', event.target.value)} />{fieldErrors.correo && <small className="field-error">{fieldErrors.correo}</small>}</label>
              <label className={fieldErrors.telefono ? 'has-error' : ''}>Teléfono<input required inputMode="tel" maxLength={25} placeholder="Ej.: 70012345" value={form.telefono} aria-invalid={Boolean(fieldErrors.telefono)} onChange={(event) => change('telefono', event.target.value)} />{fieldErrors.telefono && <small className="field-error">{fieldErrors.telefono}</small>}</label>
              <label className={fieldErrors.fecha_nacimiento ? 'has-error' : ''}>Fecha de nacimiento<input required type="date" max={today} value={form.fecha_nacimiento} aria-invalid={Boolean(fieldErrors.fecha_nacimiento)} onChange={(event) => change('fecha_nacimiento', event.target.value)} />{fieldErrors.fecha_nacimiento && <small className="field-error">{fieldErrors.fecha_nacimiento}</small>}</label>
            </div>
            {canCharge && <label>Membresía elegida<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} disabled={plans.loading}><option value="">Elegir después</option>{plans.data?.map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre} · {plan.precio} {plan.moneda}</option>)}</select>{plans.error && <small role="alert">{plans.error}</small>}</label>}
            {error && <p className="staff-error" role="alert">{error}</p>}
          </div>
          <footer>
            <button className="text-link" type="button" disabled={busy} onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="button button-dark" disabled={busy}>{busy ? 'Creando…' : 'Crear cliente'}</button>
          </footer>
        </form>
      </div>, document.body)}

    {credentials && <div className="staff-credentials" role="dialog" aria-modal="true">
      <div>
        <h2>Datos para entregar</h2>
        <p>Copialos ahora y envíalos por privado. No volverán a mostrarse.</p>
        <CopyField label="Usuario" value={credentials.correo} />
        <CopyField label="Contraseña temporal" value={credentials.contrasena_temporal} />
        <CopyButton
          value={`Usuario: ${credentials.correo}
Contraseña temporal: ${credentials.contrasena_temporal}`}
          label="Copiar los dos"
          copiedLabel="Datos copiados"
        />
        <button className="button button-dark" type="button" onClick={() => setCredentials(null)}>Entendido</button>
      </div>
    </div>}
    {checkout && !credentials && typeof document !== 'undefined' && createPortal(<div className="staff-modal-layer"><div className="staff-modal panel-editor-modal" role="dialog" aria-modal="true" aria-label="Asignar membresía"><ClientMembershipCheckout key={checkout.userId} userId={checkout.userId} initialPlanId={checkout.planId} onDone={() => setCheckout(null)} /></div></div>, document.body)}
    {classAdjustment && typeof document !== 'undefined' && createPortal(<div className="staff-modal-layer"><div className="staff-modal panel-editor-modal" role="dialog" aria-modal="true" aria-label="Agregar clases"><ClientMembershipClasses key={classAdjustment.userId} {...classAdjustment} onDone={() => setClassAdjustment(null)} /></div></div>, document.body)}
    {confirmDialog}
  </section>;
}
