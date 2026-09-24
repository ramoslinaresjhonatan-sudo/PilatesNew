"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { StatusState } from "@/components/status-state";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  ACCESS_ENDPOINTS,
  createRole,
  deactivateRole,
  reactivateRole,
  type PermissionsResponse,
  type RolesResponse,
  updateRole,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  ACCESS_LABELS,
  getModuleLabel,
  getPermissionAccess,
  getPermissionDetail,
  getPermissionName,
  type PermissionAccess,
} from "@/lib/permissions";
import type { PermissionRecord, RoleWithPermissions } from "@/lib/types";

type DialogState = { mode: "create" | "edit"; role?: RoleWithPermissions };
type Feedback = { kind: "success" | "error"; text: string };
type AccessFilter = PermissionAccess | "todos";

const ACCESS_FILTERS: Array<{ value: AccessFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "lectura", label: "Lectura" },
  { value: "escritura", label: "Escritura" },
];

function unwrap<T>(value: T[] | { datos: T[] } | null) {
  if (!value) return [];
  return Array.isArray(value) ? value : value.datos || [];
}

function isAdminRole(role: RoleWithPermissions) {
  return role.nombre === "ADMINISTRADOR";
}

function isInactiveRole(role: RoleWithPermissions) {
  return role.estado === "INACTIVO";
}

export function RoleAccessManager({ canManage }: { canManage: boolean }) {
  const rolesResource = useApiResource<RolesResponse>(
    ACCESS_ENDPOINTS.roles,
    true,
  );
  const permissionsResource = useApiResource<PermissionsResponse>(
    ACCESS_ENDPOINTS.permissions,
    true,
  );
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [actionRoleId, setActionRoleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [listFilter, setListFilter] = useState<AccessFilter>("todos");
  const [dialogFilter, setDialogFilter] = useState<AccessFilter>("todos");
  const { confirm, confirmDialog } = useConfirm();
  const closeRef = useRef<HTMLButtonElement>(null);

  const roles = unwrap(rolesResource.data);
  const permissions = unwrap(permissionsResource.data);
  const activeRoles = roles.filter((role) => !isInactiveRole(role));
  const inactiveRoles = roles.filter(isInactiveRole);
  const permissionGroups = useMemo(() => {
    return permissions.reduce<Record<string, PermissionRecord[]>>(
      (groups, permission) => {
        const key = getModuleLabel(permission.modulo);
        groups[key] = [...(groups[key] || []), permission];
        return groups;
      },
      {},
    );
  }, [permissions]);
  const groupedPermissions = useMemo(
    () =>
      Object.entries(permissionGroups).sort(([left], [right]) =>
        left.localeCompare(right, "es"),
      ),
    [permissionGroups],
  );
  const accessCounts = useMemo(
    () =>
      permissions.reduce(
        (totals, permission) => ({
          ...totals,
          [getPermissionAccess(permission)]:
            totals[getPermissionAccess(permission)] + 1,
        }),
        { lectura: 0, escritura: 0 } as Record<PermissionAccess, number>,
      ),
    [permissions],
  );
  const filterGroups = (filter: AccessFilter) =>
    groupedPermissions
      .map(
        ([moduleName, items]) =>
          [
            moduleName,
            filter === "todos"
              ? items
              : items.filter((item) => getPermissionAccess(item) === filter),
          ] as const,
      )
      .filter(([, items]) => items.length > 0);
  const countFor = (filter: AccessFilter) =>
    filter === "todos" ? permissions.length : accessCounts[filter];
  const canOpenRoleForm =
    canManage && !permissionsResource.loading && !permissionsResource.error;

  useEffect(() => {
    if (!dialog && !catalogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || submitting) return;
      if (dialog) setDialog(null);
      else setCatalogOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [catalogOpen, dialog, submitting]);

  function refreshRoles() {
    rolesResource.retry();
  }

  function openCreate() {
    setDialog({ mode: "create" });
    setRoleName("");
    setRoleDescription("");
    setSelectedIds([]);
    setDialogFilter("todos");
    setFeedback(null);
  }

  function openEdit(role: RoleWithPermissions) {
    if (isAdminRole(role) || isInactiveRole(role)) return;
    setDialog({ mode: "edit", role });
    setRoleName(role.nombre);
    setRoleDescription(role.descripcion || "");
    setSelectedIds(role.permisos.map((permission) => permission.id));
    setDialogFilter("todos");
    setFeedback(null);
  }

  function togglePermission(permissionId: string) {
    setSelectedIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || submitting) return;

    const name = roleName.trim();
    if (name.length < 2) {
      setFeedback({
        kind: "error",
        text: "El rol necesita un nombre de al menos 2 caracteres.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const payload = {
      nombre: name,
      descripcion: roleDescription.trim() || null,
      permiso_ids: selectedIds,
    };

    try {
      const response =
        dialog.mode === "create"
          ? await createRole(payload)
          : await updateRole(dialog.role!.id, payload);
      setDialog(null);
      setFeedback({
        kind: "success",
        text:
          response.message ||
          (dialog.mode === "create" ? "Rol creado." : "Rol actualizado."),
      });
      refreshRoles();
    } catch (caught) {
      setFeedback({ kind: "error", text: getErrorMessage(caught) });
    } finally {
      setSubmitting(false);
    }
  }

  async function annulRole(role: RoleWithPermissions) {
    if (isAdminRole(role) || isInactiveRole(role) || actionRoleId) return;
    const accepted = await confirm({
      title: `¿Anular el rol ${role.nombre}?`,
      description:
        "Dejará de poder asignarse. Solo puede anularse cuando ningún usuario tenga este rol.",
      confirmLabel: "Anular rol",
      tone: "danger",
    });
    if (!accepted) return;

    setActionRoleId(role.id);
    setFeedback(null);
    try {
      const response = await deactivateRole(role.id);
      setFeedback({
        kind: "success",
        text: response.message || `Rol ${role.nombre} anulado.`,
      });
      refreshRoles();
    } catch (caught) {
      setFeedback({ kind: "error", text: getErrorMessage(caught) });
    } finally {
      setActionRoleId(null);
    }
  }

  async function restoreRole(role: RoleWithPermissions) {
    if (!isInactiveRole(role) || actionRoleId) return;
    setActionRoleId(role.id);
    setFeedback(null);
    try {
      const response = await reactivateRole(role.id);
      setFeedback({
        kind: "success",
        text: response.message || `Rol ${role.nombre} reactivado.`,
      });
      refreshRoles();
    } catch (caught) {
      setFeedback({ kind: "error", text: getErrorMessage(caught) });
    } finally {
      setActionRoleId(null);
    }
  }

  if (rolesResource.loading) {
    return (
      <StatusState
        kind="loading"
        title="Cargando roles"
        description="Un momento, estamos cargando los roles."
      />
    );
  }

  if (rolesResource.error) {
    return (
      <StatusState
        kind="error"
        title="No pudimos cargar roles"
        description={rolesResource.error}
        actionLabel="Reintentar"
        onAction={rolesResource.retry}
      />
    );
  }

  return (
    <section
      className="role-access schedule-manager"
      aria-labelledby="role-access-title"
    >
      <header className="staff-manager__header role-access__heading">
        <div>
          <h2 id="role-access-title">Roles y permisos</h2>
          <p>
            Definí qué puede consultar o administrar cada grupo de usuarios.
          </p>
        </div>
        <div className="role-access__header-actions">
          <button
            className="button role-access__catalog"
            type="button"
            onClick={() => setCatalogOpen(true)}
          >
            Ver permisos
          </button>
          {canManage && (
            <button
              className="button button-dark role-access__create"
              type="button"
              disabled={!canOpenRoleForm}
              onClick={openCreate}
            >
              + Crear rol
            </button>
          )}
        </div>
      </header>

      <p className="role-access__guide schedule-guidance">
        Primero asigná <strong>Ver</strong> para que el rol pueda consultar un
        módulo. Después agregá permisos de administración solo si también
        necesita hacer cambios.
      </p>

      {feedback && (
        <p
          className={`role-access__message role-access__message--${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </p>
      )}

      <div className="role-access__layout">
        <section className="role-panel" aria-label="Roles disponibles">
          {!canManage && (
            <div className="notice-card">
              <span aria-hidden="true">i</span>
              <div>
                <h3>Consulta unicamente</h3>
                <p>
                  Tu rol puede revisar accesos, pero solo roles.manage permite
                  crear o editar.
                </p>
              </div>
            </div>
          )}
          {canManage && permissionsResource.error && (
            <div className="notice-card">
              <span aria-hidden="true">i</span>
              <div>
                <h3>Permisos no disponibles</h3>
                <p>{permissionsResource.error}</p>
              </div>
            </div>
          )}

          <div className="role-access__list">
            {activeRoles.map((role) => {
              const protectedAdmin = isAdminRole(role);
              const working = actionRoleId === role.id;
              return (
                <article key={role.id} className="role-card">
                  <div className="role-card__identity">
                    <span>{role.nombre.slice(0, 2)}</span>
                    <div>
                      <h3>{role.nombre}</h3>
                      <p>
                        {role.descripcion || "Rol del equipo Pilates House"}
                      </p>
                    </div>
                  </div>
                  <div
                    className="role-card__access-summary"
                    aria-label={`${role.permisos.length} permisos asignados a ${role.nombre}`}
                  >
                    <strong>{role.permisos.length}</strong>
                    <span>
                      {role.permisos.length === 1
                        ? "permiso asignado"
                        : "permisos asignados"}
                    </span>
                    <small>
                      {role.permisos.length
                        ? "Podés revisarlos al editar el rol."
                        : "Todavía no tiene accesos asignados."}
                    </small>
                  </div>
                  {canManage && (
                    <div className="role-card__actions">
                      <button
                        type="button"
                        disabled={protectedAdmin || !canOpenRoleForm}
                        onClick={() => openEdit(role)}
                      >
                        {protectedAdmin ? "Protegido" : "Editar"}
                      </button>
                      <button
                        type="button"
                        disabled={protectedAdmin || working}
                        onClick={() => void annulRole(role)}
                      >
                        {working ? "Anulando..." : "Anular"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {inactiveRoles.length > 0 && (
        <section
          className="role-panel role-panel--annulled"
          aria-labelledby="roles-annulled-title"
        >
          <header className="role-panel__header">
            <div>
              <span>ANULADOS</span>
              <h3 id="roles-annulled-title">Roles anulados</h3>
              <p>No estan disponibles para nuevos accesos.</p>
            </div>
          </header>
          <div className="role-access__list role-access__list--muted">
            {inactiveRoles.map((role) => (
              <article key={role.id} className="role-card">
                <div className="role-card__identity">
                  <span>{role.nombre.slice(0, 2)}</span>
                  <div>
                    <h3>{role.nombre}</h3>
                    <p>{role.descripcion || "Rol anulado"}</p>
                  </div>
                </div>
                <div className="role-card__actions">
                  <small>
                    {role.fecha_anulacion
                      ? `Anulado ${formatDateTime(role.fecha_anulacion)}`
                      : "Fecha no registrada"}
                  </small>
                  {canManage && (
                    <button
                      className="role-card__restore"
                      type="button"
                      disabled={actionRoleId === role.id}
                      onClick={() => void restoreRole(role)}
                    >
                      {actionRoleId === role.id
                        ? "Restableciendo..."
                        : "Restablecer"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {catalogOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="staff-modal-layer"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCatalogOpen(false);
            }}
          >
            <section
              className="membership-modal panel-editor-modal permissions-catalog-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="permissions-catalog-title"
            >
              <header>
                <div>
                  <span>CATÁLOGO</span>
                  <h2 id="permissions-catalog-title">Permisos disponibles</h2>
                  <p>
                    {permissions.length} permisos activos ·{" "}
                    {accessCounts.lectura} de lectura y {accessCounts.escritura}{" "}
                    de escritura.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar catálogo de permisos"
                  onClick={() => setCatalogOpen(false)}
                >
                  ×
                </button>
              </header>
              <div className="membership-modal__body">
                <div
                  className="access-filter"
                  role="group"
                  aria-label="Filtrar permisos por tipo de acceso"
                >
                  {ACCESS_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={listFilter === option.value ? "is-active" : ""}
                      aria-pressed={listFilter === option.value}
                      onClick={() => setListFilter(option.value)}
                    >
                      {option.label} <span>{countFor(option.value)}</span>
                    </button>
                  ))}
                </div>
                {permissionsResource.loading ? (
                  <p className="role-catalog__state">Cargando permisos…</p>
                ) : permissionsResource.error ? (
                  <p className="role-catalog__state" role="alert">
                    {permissionsResource.error}
                  </p>
                ) : (
                  <div className="permission-list">
                    {filterGroups(listFilter).map(([moduleName, items]) => (
                      <section key={moduleName}>
                        <h3>{moduleName}</h3>
                        <ul>
                          {items.map((permission) => (
                            <li key={permission.id}>
                              <div>
                                <strong>{getPermissionName(permission)}</strong>
                                <small>{getPermissionDetail(permission)}</small>
                              </div>
                              <span
                                className={`access-tag access-tag--${getPermissionAccess(permission)}`}
                              >
                                {ACCESS_LABELS[getPermissionAccess(permission)]}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
              <footer>
                <button type="button" onClick={() => setCatalogOpen(false)}>
                  Cerrar
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}

      {dialog &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="staff-modal-layer"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !submitting)
                setDialog(null);
            }}
          >
            <form
              className="membership-modal panel-editor-modal role-editor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="role-modal-title"
              aria-busy={submitting}
              onSubmit={saveRole}
            >
              <header>
                <div>
                  <span>
                    {dialog.mode === "create" ? "NUEVO ROL" : "EDITAR ROL"}
                  </span>
                  <h2 id="role-modal-title">
                    {dialog.mode === "create" ? "Crear rol" : roleName}
                  </h2>
                  <p>
                    Elegí los accesos necesarios, sin agregar permisos que este
                    rol no vaya a usar.
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Cerrar editor de rol"
                  disabled={submitting}
                  onClick={() => setDialog(null)}
                >
                  ×
                </button>
              </header>
              <div className="role-editor-modal__identity">
                <div className="role-modal__fields">
                  <label>
                    <span>Nombre del rol</span>
                    <input
                      value={roleName}
                      onChange={(event) => setRoleName(event.target.value)}
                      maxLength={40}
                      placeholder="Ejemplo: Recepción"
                      required
                    />
                  </label>
                  <label>
                    <span>Descripción corta</span>
                    <textarea
                      value={roleDescription}
                      onChange={(event) =>
                        setRoleDescription(event.target.value)
                      }
                      maxLength={150}
                      rows={2}
                      placeholder="Ejemplo: Atiende clientes y consulta la agenda."
                    />
                  </label>
                </div>
              </div>
              <div className="membership-modal__body">
                <div className="role-modal__permission-heading">
                  <div>
                    <span>Permisos asignados</span>
                    <p>
                      Marcá solo lo que este rol necesita para su trabajo
                      diario.
                    </p>
                  </div>
                  <strong
                    aria-label={`${selectedIds.length} permisos seleccionados`}
                  >
                    {selectedIds.length}
                  </strong>
                </div>
                <div
                  className="access-filter"
                  role="group"
                  aria-label="Filtrar permisos por tipo de acceso"
                >
                  {ACCESS_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        dialogFilter === option.value ? "is-active" : ""
                      }
                      aria-pressed={dialogFilter === option.value}
                      onClick={() => setDialogFilter(option.value)}
                    >
                      {option.label} <span>{countFor(option.value)}</span>
                    </button>
                  ))}
                </div>
                <div className="role-modal__groups">
                  {filterGroups(dialogFilter).map(([moduleName, items]) => (
                    <fieldset key={moduleName}>
                      <legend>{moduleName}</legend>
                      {items.map((permission) => (
                        <label key={permission.id} title={permission.codigo}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <span>
                            <strong>{getPermissionName(permission)}</strong>
                            <small>
                              {ACCESS_LABELS[getPermissionAccess(permission)]} ·{" "}
                              {getPermissionDetail(permission)}
                            </small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                {dialogFilter !== "todos" && (
                  <p className="role-modal__filter-note">
                    El filtro solo cambia lo que ves; las selecciones de otros
                    permisos se conservan.
                  </p>
                )}

                {feedback?.kind === "error" && (
                  <p
                    className="role-modal__message role-modal__message--error"
                    role="alert"
                  >
                    {feedback.text}
                  </p>
                )}
              </div>
              <footer>
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Guardando..." : "Guardar rol"}
                </button>
              </footer>
            </form>
          </div>,
          document.body,
        )}
      {confirmDialog}
    </section>
  );
}
