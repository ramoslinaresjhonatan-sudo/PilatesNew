import type { MembershipPlan } from './types';
import { STUDIO_TIME_ZONE } from './studio-time';

export function formatMoney(value: number | string | null | undefined, currency = 'BOB') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDateTime(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: STUDIO_TIME_ZONE,
    ...(options || {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }).format(date);
}

export function getFullName(user: { nombre: string; apellido_paterno?: string | null; apellido_materno?: string | null }) {
  return [user.nombre, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ');
}

export function getMembershipCoverage(plan: MembershipPlan) {
  const classes = plan.clases_ilimitadas
    ? 'Clases ilimitadas'
    : `${plan.limite_clases ?? '—'} clases por ${plan.duracion_dias} días`;
  const sessions = (plan.beneficios || []).map((benefit) => {
    if (benefit.sesiones_ilimitadas) return `${benefit.nombre} ilimitado`;
    const quantity = benefit.cantidad_incluida ?? '—';
    const unit = quantity === 1 ? 'sesión' : 'sesiones';
    const period = benefit.periodicidad === 'MES' ? ' al mes' : benefit.periodicidad === 'SEMANA' ? ' por semana' : '';
    return `${quantity} ${unit} de ${benefit.nombre}${period}`;
  });
  return [classes, ...(plan.limite_clases_semana != null ? [`Hasta ${plan.limite_clases_semana} clases por semana`] : []), ...sessions, ...(plan.acceso_eventos ? ['Acceso a eventos exclusivos'] : [])];
}

/**
 * Los detalles comerciales se administran como texto en el panel. Una línea
 * con viñeta se convierte en un punto de la tarjeta pública para que beneficios
 * como pases, referidos o regalos no queden escondidos en un párrafo.
 */
export function getMembershipBenefitPoints(plan: MembershipPlan) {
  const points = (plan.descripcion || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•*-]\s*/, '').trim())
    .filter((line) => line.length > 0 && !/^incluye:?$/i.test(line));

  return points.length ? [...points, ...(plan.limite_clases_semana != null ? [`Hasta ${plan.limite_clases_semana} clases por semana`] : [])] : getMembershipCoverage(plan);
}
