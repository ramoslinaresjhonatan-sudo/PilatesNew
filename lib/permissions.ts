import type { PermissionRecord } from "./types";

/**
 * Traducción de los permisos para mostrarlos en el panel.
 *
 * El código (`users.read`) es el identificador técnico que verifica el backend y
 * que viaja en el token: no se traduce. Acá solo se resuelve cómo se lee en
 * pantalla, de modo que el administrador no vea nombres en inglés.
 */

export type PermissionAccess = "lectura" | "escritura";

export const ACCESS_LABELS: Record<PermissionAccess, string> = {
  lectura: "Lectura",
  escritura: "Escritura",
};

const MODULE_LABELS: Record<string, string> = {
  events: "Eventos",
  users: "Usuarios",
  roles: "Roles y permisos",
  clients: "Clientes",
  coaches: "Personal y coaches",
  content: "Contenido",
  schedule: "Agenda",
  memberships: "Membresías",
  payments: "Pagos",
  reports: "Reportes",
};

const ACTION_LABELS: Record<string, string> = {
  read: "Ver",
  list: "Ver",
  create: "Crear",
  update: "Editar",
  deactivate: "Anular",
  delete: "Eliminar",
  manage: "Administrar",
};

/**
 * Nombre canónico de los permisos conocidos. Evita depender de la descripción
 * guardada, que llega con faltas de acentuación desde el seed.
 */
const PERMISSION_NAMES: Record<string, string> = {
  "events.read": "Ver eventos y participantes",
  "events.manage": "Administrar eventos y asistencia",
  "users.read": "Ver usuarios",
  "users.create": "Crear usuarios",
  "users.update": "Editar usuarios",
  "users.deactivate": "Anular usuarios",
  "roles.read": "Ver roles y permisos",
  "roles.manage": "Administrar roles y permisos",
  "clients.read": "Ver clientes",
  "clients.manage": "Administrar clientes",
  "coaches.read": "Ver personal y coaches",
  "coaches.manage": "Administrar personal y coaches",
  "content.read": "Ver contenido",
  "content.manage": "Administrar contenido",
  "schedule.read": "Ver agenda",
  "schedule.manage": "Administrar agenda",
  "memberships.read": "Ver membresías",
  "memberships.manage": "Administrar membresías",
  "payments.read": "Ver pagos",
  "payments.manage": "Administrar pagos",
  "reports.read": "Ver reportes",
};

/** Explicación breve para decidir qué habilita cada permiso. */
const PERMISSION_DETAILS: Record<string, string> = {
  "events.read": "Consulta eventos exclusivos y sus participantes, sin modificar datos.",
  "events.manage": "Crea, edita y cancela eventos, consulta participantes y registra asistencia.",
  "users.read": "Consulta las cuentas de usuario y sus datos básicos.",
  "users.create": "Crea cuentas de usuario y les asigna roles.",
  "users.update": "Actualiza los datos de las cuentas de usuario.",
  "users.deactivate": "Anula cuentas para impedir que ingresen al sistema.",
  "roles.read": "Consulta los roles y los permisos asignados a cada uno.",
  "roles.manage": "Crea, edita, anula o reactiva roles y asigna permisos.",
  "clients.read": "Consulta datos, estado y cumpleaños de los clientes.",
  "clients.manage": "Da de alta, baja o reactiva clientes.",
  "coaches.read":
    "Consulta al personal, coaches y roles que se les pueden asignar.",
  "coaches.manage": "Gestiona personal y las fotos de los coaches.",
  "content.read":
    "Consulta disciplinas, imágenes y secciones publicadas en la web.",
  "content.manage": "Crea, edita, ordena, publica o anula contenido de la web.",
  "schedule.read": "Consulta horarios, salas, inscripciones y asistencia.",
  "schedule.manage": "Crea, edita o anula horarios y programaciones semanales.",
  "memberships.read": "Consulta planes y membresías de los clientes.",
  "memberships.manage": "Gestiona los planes de membresía que se ofrecen.",
  "payments.read": "Consulta pagos, órdenes y la cola de conciliación.",
  "payments.manage":
    "Se preparó para gestionar cobros y conciliaciones cuando estén habilitados.",
  "reports.read":
    "Se preparó para consultar reportes cuando el módulo esté habilitado.",
};

/** Solo estas acciones consultan sin modificar; el resto escribe. */
const READ_ACTIONS = new Set(["read", "list", "ver", "listar", "consultar"]);

/** Un módulo o acción que todavía no está en el diccionario se muestra legible. */
function humanize(value: string) {
  const clean = value
    .trim()
    .replace(/[_.-]+/g, " ")
    .trim();
  if (!clean) return "";
  return (
    clean.charAt(0).toLocaleUpperCase("es") +
    clean.slice(1).toLocaleLowerCase("es")
  );
}

function actionOf(permission: PermissionRecord) {
  return (permission.accion || permission.codigo.split(".")[1] || "")
    .trim()
    .toLowerCase();
}

export function getModuleLabel(module?: string | null) {
  const key = (module || "").trim().toLowerCase();
  return MODULE_LABELS[key] || humanize(key) || "Otros";
}

export function getActionLabel(action?: string | null) {
  const key = (action || "").trim().toLowerCase();
  return ACTION_LABELS[key] || humanize(key) || "Usar";
}

export function getPermissionAccess(
  permission: PermissionRecord,
): PermissionAccess {
  return READ_ACTIONS.has(actionOf(permission)) ? "lectura" : "escritura";
}

/**
 * Nombre legible del permiso. La descripción guardada ya viene en español
 * ("Ver usuarios"); si falta, se arma con el módulo y la acción.
 */
export function getPermissionName(permission: PermissionRecord) {
  const canonical = PERMISSION_NAMES[permission.codigo.trim().toLowerCase()];
  if (canonical) return canonical;
  const described = permission.descripcion?.trim();
  if (described) return described;
  return `${getActionLabel(permission.accion)} ${getModuleLabel(permission.modulo).toLocaleLowerCase("es")}`;
}

export function getPermissionDetail(permission: PermissionRecord) {
  const canonical = PERMISSION_DETAILS[permission.codigo.trim().toLowerCase()];
  if (canonical) return canonical;
  const described = permission.descripcion?.trim();
  if (described) return described;
  return `${getActionLabel(permission.accion)} · ${getModuleLabel(permission.modulo)}`;
}
