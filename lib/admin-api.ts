'use client';

import { apiRequest } from './api';
import type { PermissionRecord, RoleWithPermissions } from './types';

export const ACCESS_ENDPOINTS = {
  roles: '/rol?incluir_permisos=true',
  permissions: '/permiso',
  role: (roleId: string) => `/rol/${encodeURIComponent(roleId)}`,
  reactivateRole: (roleId: string) => `/rol/${encodeURIComponent(roleId)}/reactivar`,
  rolePermissions: (roleId: string) => `/rol/${encodeURIComponent(roleId)}/permisos`,
} as const;

export type RolesResponse = RoleWithPermissions[] | { datos: RoleWithPermissions[] };
export type PermissionsResponse = PermissionRecord[] | { datos: PermissionRecord[] };
export type RolePayload = {
  nombre: string;
  descripcion?: string | null;
  permiso_ids: string[];
};

export function updateRolePermissions(roleId: string, permissionIds: string[]) {
  return apiRequest<{ message?: string; rol?: RoleWithPermissions }>(ACCESS_ENDPOINTS.rolePermissions(roleId), {
    method: 'PUT',
    body: { permiso_ids: permissionIds },
    authenticated: true,
  });
}

export function createRole(payload: RolePayload) {
  return apiRequest<{ message?: string; rol?: RoleWithPermissions }>(ACCESS_ENDPOINTS.roles, {
    method: 'POST',
    body: payload,
    authenticated: true,
  });
}

export function updateRole(roleId: string, payload: RolePayload) {
  return apiRequest<{ message?: string; rol?: RoleWithPermissions }>(ACCESS_ENDPOINTS.role(roleId), {
    method: 'PATCH',
    body: payload,
    authenticated: true,
  });
}

export function deactivateRole(roleId: string) {
  return apiRequest<{ message?: string; rol?: RoleWithPermissions }>(ACCESS_ENDPOINTS.role(roleId), {
    method: 'DELETE',
    authenticated: true,
  });
}

export function reactivateRole(roleId: string) {
  return apiRequest<{ message?: string; rol?: RoleWithPermissions }>(ACCESS_ENDPOINTS.reactivateRole(roleId), {
    method: 'POST',
    authenticated: true,
  });
}
