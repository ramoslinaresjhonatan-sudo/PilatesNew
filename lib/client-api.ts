'use client';

import { apiRequest } from './api';
import type { ActiveMembership, ProfileResponse } from './types';

export const CLIENT_ENDPOINTS = {
  profile: '/perfil',
  activeMembership: '/membresia/activa',
  membershipOrders: '/orden-membresia',
  payment: (paymentId: number | string) => `/pago/${encodeURIComponent(String(paymentId))}`,
  cancelPayment: (paymentId: number | string) => `/pago/${encodeURIComponent(String(paymentId))}/cancelar`,
  classReservation: (agendaId: number | string) => `/agenda/${encodeURIComponent(String(agendaId))}/reserva`,
  sessionAppointments: '/cita-sesion',
} as const;

export type PaymentState = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'EXPIRADO' | 'CANCELADO' | 'EN_REVISION' | string;

export type MembershipOrderResponse = {
  orden?: { id: string; estado: string };
  pago?: {
    id: string;
    estado: PaymentState;
    qr_imagen_url?: string | null;
    qr_texto?: string | null;
    qr_expiracion?: string | null;
    referencia?: string | null;
    fecha_generacion?: string | null;
  };
  membresia?: ActiveMembership | null;
  message?: string;
};

export type PaymentStatusResponse = {
  id: string;
  estado: PaymentState;
  membresia?: ActiveMembership | null;
  message?: string;
};

export type PendingMembershipPayment = {
  plan_slug: string;
  plan_nombre: string;
  pago: NonNullable<MembershipOrderResponse['pago']>;
};

export type ReservationResponse = {
  id?: string;
  estado?: string;
  message?: string;
};

export function getClientProfile() {
  return apiRequest<ProfileResponse>(CLIENT_ENDPOINTS.profile, { authenticated: true });
}

export function getActiveMembership() {
  return apiRequest<ActiveMembership>(CLIENT_ENDPOINTS.activeMembership, { authenticated: true });
}

export function updateOwnProfile(body: FormData) {
  const value = (key: string) => String(body.get(key) || '').trim();
  return apiRequest<ProfileResponse>(CLIENT_ENDPOINTS.profile, {
    method: 'PATCH',
    body: {
      name: value('nombre'),
      paternalSurname: value('apellido_paterno') || null,
      maternalSurname: value('apellido_materno') || null,
      phone: value('telefono') || null,
    },
    authenticated: true,
  });
}

export function createMembershipOrder(planId: string) {
  return apiRequest<MembershipOrderResponse>(CLIENT_ENDPOINTS.membershipOrders, {
    method: 'POST',
    body: { plan_membresia_id: planId },
    authenticated: true,
  });
}

export function getPaymentStatus(paymentId: string) {
  return apiRequest<PaymentStatusResponse>(CLIENT_ENDPOINTS.payment(paymentId), { authenticated: true });
}

export function getPendingMembershipPayment() {
  return apiRequest<PendingMembershipPayment | null>('/pago/pendiente', { authenticated: true });
}

export function cancelMembershipPayment(paymentId: string) {
  return apiRequest<PaymentStatusResponse>(CLIENT_ENDPOINTS.cancelPayment(paymentId), {
    method: 'POST',
    authenticated: true,
  });
}

export function reserveClass(agendaId: string) {
  return apiRequest<ReservationResponse>(CLIENT_ENDPOINTS.classReservation(agendaId), {
    method: 'POST',
    authenticated: true,
  });
}

export function requestSessionAppointment(body: {
  actividad_id: string;
  fecha_preferida: string;
  hora_preferida: string;
  comentario?: string;
}) {
  return apiRequest<ReservationResponse>(CLIENT_ENDPOINTS.sessionAppointments, {
    method: 'POST',
    body,
    authenticated: true,
  });
}

