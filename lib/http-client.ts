'use client';

import axios, { AxiosHeaders } from 'axios';

import { clearSession, readSession } from './auth';

const localApiUrl = 'http://localhost:3001/api/v1';

function normalizeApiUrl(value: string | undefined) {
  try {
    const url = new URL(value?.trim() || localApiUrl);
    const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !isLocalHttp) return localApiUrl;
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return localApiUrl;
  }
}

function normalizeHeaders(headers: HeadersInit | undefined) {
  const normalized = new AxiosHeaders();
  if (!headers) return normalized;

  new Headers(headers).forEach((value, key) => normalized.set(key, value));
  return normalized;
}

function clampTimeout(timeoutMs: number) {
  return Number.isFinite(timeoutMs) ? Math.max(1000, Math.min(30000, timeoutMs)) : 15000;
}

function validateApiPath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) {
    throw new Error('La ruta de API debe ser relativa y segura.');
  }
}

function getTextField(value: unknown, key: string) {
  return value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

function getServerMessage(payload: unknown) {
  const directMessage = getTextField(payload, 'message') || getTextField(payload, 'mensaje');
  const nestedError = getTextField(payload, 'error');
  const nestedMessage = getTextField(nestedError, 'message') || getTextField(nestedError, 'mensaje');

  return String(directMessage || nestedMessage || 'No fue posible completar la solicitud.').slice(0, 500);
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  authenticated?: boolean;
  timeoutMs?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json' },
  timeout: 15000,
  validateStatus: (status) => status >= 200 && status < 300,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers);
  headers.set('Accept', 'application/json');
  config.headers = headers;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) clearSession();
    return Promise.reject(error);
  },
);

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  validateApiPath(path);

  const { body, authenticated = false, timeoutMs = 15000, headers, signal, method = 'GET' } = options;
  const session = authenticated ? readSession() : null;
  if (authenticated && !session) throw new ApiError('Debes iniciar sesión para continuar.', 401);

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = normalizeHeaders(headers);
  if (authenticated && session) requestHeaders.set('Authorization', `Bearer ${session.token}`);
  if (body !== undefined && !isFormData && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  try {
    const response = await apiClient.request<T>({
      data: body,
      headers: requestHeaders,
      method,
      signal: signal ?? undefined,
      timeout: clampTimeout(timeoutMs),
      url: path,
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        if (error.response.status === 401) clearSession();
        throw new ApiError(getServerMessage(error.response.data), error.response.status, error.response.data);
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ERR_CANCELED') {
        throw new ApiError('La solicitud tardó demasiado. Intenta nuevamente.', 408, error.toJSON());
      }
    }

    throw new ApiError('No pudimos conectar con el servicio en este momento.', 0);
  }
}

export function safeAssetUrl(value: string | null | undefined, fallback: string, assetId?: string) {
  if (!value) return fallback;
  if (value.startsWith('/assets/')) return value;
  if (/^(coaches|Diciplinas|memberships|gallery|landing)\//.test(value)) return `/assets/${value}`;
  if (value.startsWith('/')) {
    try {
      const origin = new URL(API_URL).origin;
      return new URL(value, origin).toString();
    } catch {
      return fallback;
    }
  }

  if (value.startsWith('r2://') && assetId) {
    try {
      return new URL(`imagen/${encodeURIComponent(assetId)}`, `${API_URL}/`).toString();
    } catch {
      return fallback;
    }
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.origin === new URL(API_URL).origin ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function isTransientApiError(error: unknown) {
  return error instanceof ApiError && [0, 408, 425, 429, 500, 502, 503, 504].includes(error.status);
}

export function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
}
