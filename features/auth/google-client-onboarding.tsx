'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { getPostLoginDestination, saveSession } from '@/lib/auth';
import type { AuthSession, AuthUser } from '@/lib/types';

type RefreshResponse = {
  data: {
    accessToken: string;
    expiresIn: number;
    user: { id: string; name: string; email: string; roles: readonly string[]; permissions: readonly string[] };
  };
};

function toSession(response: RefreshResponse): AuthSession {
  const user: AuthUser = {
    id: response.data.user.id,
    nombre: response.data.user.name,
    correo: response.data.user.email,
    roles: [...response.data.user.roles],
    permisos: [...response.data.user.permissions],
  };
  return {
    token: response.data.accessToken,
    expiresAt: new Date(Date.now() + response.data.expiresIn * 1000).toISOString(),
    user,
  };
}

export function GoogleClientOnboarding({ nextPath }: { nextPath: string | null }) {
  const router = useRouter();
  const started = useRef(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void apiRequest<RefreshResponse>('/auth/refresh', { method: 'POST' })
      .then((response) => {
        const nextSession = toSession(response);
        saveSession(nextSession);
        setSession(nextSession);
      })
      .catch((caught) => setError(getErrorMessage(caught)))
      .finally(() => setCheckingSession(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || submitting) return;
    const values = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/perfil/registro-google', {
        method: 'PUT',
        authenticated: true,
        body: {
          telefono: String(values.get('telefono') || '').trim(),
          fecha_nacimiento: String(values.get('fecha_nacimiento') || ''),
          acepta_terminos: values.get('acepta_terminos') === 'on',
        },
      });
      router.replace(getPostLoginDestination(session, nextPath));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <div className="onboarding-badge">
            <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>
            Cuenta de Google verificada
          </div>
          <div className="login-panel__heading"><h1>Terminemos tu registro</h1><p>Solo necesitamos estos datos para preparar tu espacio House.</p></div>
          {checkingSession && <p>Verificando tu acceso…</p>}
          {!checkingSession && !session && <><p className="form-error" role="alert">{error || 'Tu sesión no está disponible. Intentá ingresar nuevamente.'}</p><button className="button button-dark" type="button" onClick={() => router.replace('/login')}>Volver a ingresar</button></>}
          {!checkingSession && session && <form className="auth-form" onSubmit={submit}>
            <div className="auth-form-section">
              <div className="form-row">
                <label className="form-field"><span>Teléfono</span><input name="telefono" type="tel" autoComplete="tel" placeholder="Ej.: 70000000" required minLength={8} maxLength={8} inputMode="numeric" pattern="[0-9]{8}" onInput={event => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 8); }} /></label>
                <label className="form-field"><span>Fecha de nacimiento</span><input name="fecha_nacimiento" type="date" autoComplete="bday" required /></label>
              </div>
              <label className="onboarding-checkbox"><input name="acepta_terminos" type="checkbox" required /> Acepto el tratamiento de mis datos para gestionar mi cuenta y membresía.</label>
            </div>
            {error && <div className="form-error" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
            <div className="onboarding-actions"><button className="button button-dark submit-button" disabled={submitting}>{submitting ? 'Guardando…' : 'Entrar a mi espacio'}</button></div>
          </form>}
        </div>
      </div>
    </main>
  );
}
