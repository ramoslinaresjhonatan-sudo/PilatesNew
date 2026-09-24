import type { ActivityCategory, KnownActivityCategory } from './types';

export const CATEGORY_LABELS: Record<KnownActivityCategory, string> = {
  CLASE: 'Clase',
  SESION: 'Sesión',
  EXPERIENCIA: 'Experiencia',
  EVENTO: 'Evento',
};

export function getCategoryLabel(category: ActivityCategory) {
  const normalized = String(category).trim().toUpperCase();
  if (normalized in CATEGORY_LABELS) return CATEGORY_LABELS[normalized as KnownActivityCategory];
  return normalized
    .toLocaleLowerCase('es')
    .replace(/[_-]+/g, ' ')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'));
}

/**
 * El boton de las secciones no se edita desde el panel: siempre dice lo mismo y
 * siempre lleva a la galeria. El backend guarda estos valores; aca quedan como
 * respaldo para las secciones creadas antes de esa regla.
 */
export const SECTION_ACTION_LABEL = 'VER GALERÍA Y EVENTOS';
export const SECTION_ACTION_URL = '/galeria';

export const MANAGEMENT_MODULES = [
  { slug: 'eventos', eyebrow: 'EVENTOS EXCLUSIVOS', title: 'Eventos', description: 'Eventos, cupos, reservas y asistencia de miembros con acceso.', endpoint: '/admin/evento', icon: 'calendar', permissions: ['events.read', 'events.manage'] },
  { slug: 'clientes', eyebrow: 'COMUNIDAD', title: 'Clientes', description: 'Datos de contacto de los clientes, altas y bajas.', endpoint: '/cliente?pagina=1&limite=50', icon: 'people', permissions: ['clients.read', 'clients.manage', 'users.read', 'users.update'] },
  { slug: 'membresias', eyebrow: 'PLANES HOUSE', title: 'Membresías', description: 'Planes que se venden: clases incluidas, sesiones, duración y precio.', endpoint: '/plan-membresia', icon: 'membership', permissions: ['memberships.read', 'memberships.manage'] },
  { slug: 'pagos', eyebrow: 'CONTROL DE COBROS', title: 'Pagos', description: 'Cobros recibidos, órdenes de compra y pagos que necesitan revisión.', endpoint: '/pago', icon: 'payments', permissions: ['payments.read', 'payments.manage'] },
  { slug: 'disciplinas', eyebrow: 'ORDEN DEL DÍA', title: 'Disciplinas', description: 'Clases, sesiones y experiencias del estudio, y su orden en la web.', endpoint: '/admin/actividad', icon: 'calendar', permissions: ['content.read', 'content.manage'] },
  { slug: 'agenda', eyebrow: 'ORDEN DEL DÍA', title: 'Agenda', description: 'Armá horarios de clases y asigná coaches.', endpoint: '/agenda', icon: 'calendar', permissions: ['schedule.read', 'schedule.manage'] },
  { slug: 'inscripciones', eyebrow: 'CONTROL DE ACCESOS', title: 'Inscripciones y asistencia', description: 'Revisá reservas, tipo de acceso y asistencia de cada cliente.', endpoint: '/inscripcion', icon: 'people', permissions: ['schedule.read', 'schedule.manage'] },
  { slug: 'personal', eyebrow: 'CASA EQUIPO', title: 'Personal', description: 'Información y roles de las personas que hacen posible el estudio.', endpoint: '/coach', icon: 'people', permissions: ['coaches.read', 'coaches.manage'] },
  { slug: 'galeria', eyebrow: 'LA CASA POR DENTRO', title: 'Galería y experiencias', description: 'Fotos, experiencias y eventos que se muestran en la página principal.', endpoint: '/landing/seccion', icon: 'gallery', permissions: ['content.read', 'content.manage'] },
  { slug: 'certificaciones', eyebrow: 'FORMACIÓN HOUSE', title: 'Certificaciones', description: 'Programas de formación, temarios, precios y contenidos.', endpoint: null, icon: 'certificate', permissions: ['content.read', 'content.manage'] },
  { slug: 'roles', eyebrow: 'SEGURIDAD', title: 'Roles y permisos', description: 'Administrá qué módulos y acciones puede utilizar cada rol.', endpoint: null, icon: 'shield', permissions: ['roles.read', 'roles.manage'] },
] as const;

export type ManagementModule = (typeof MANAGEMENT_MODULES)[number];

export function canAccessManagementModule(module: ManagementModule, roles: string[], permissions: string[]) {
  if (roles.includes('ADMINISTRADOR')) return true;
  return module.permissions.some((permission) => permissions.includes(permission));
}
