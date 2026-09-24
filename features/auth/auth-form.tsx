'use client';

import { LoginStory } from './login-story';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { API_URL, apiRequest, getErrorMessage } from '@/lib/api';
import { getPostLoginDestination, saveSession } from '@/lib/auth';
import type { AuthSession, AuthUser } from '@/lib/types';
import { useHydrated } from '@/hooks/use-auth-session';

type BackendAuthUser = {
  id: string;
  name: string;
  email: string;
  roles: readonly string[];
  permissions: readonly string[];
};
type LoginResponse = {
  data: {
    accessToken: string;
    expiresIn: number;
    user: BackendAuthUser;
  };
};
type RegisterResponse = { message: string; usuario: { id: string; nombre: string; correo: string } };

function toAuthenticatedSession(response: LoginResponse): AuthSession {
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

/* Palabras que se pegan al apellido que les sigue: "de la Cruz" es un apellido solo. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos', 'y', 'e', 'van', 'von', 'di', 'du', 'san', 'santa']);

/**
 * El formulario pide los apellidos juntos, pero se guardan separados como en el
 * resto del sistema. Devuelve [paterno, materno] sin cortar apellidos compuestos.
 */
function separarApellidos(texto: string): [string, string] {
  const apellidos: string[] = [];
  let pendiente = '';
  for (const pieza of texto.trim().split(/\s+/).filter(Boolean)) {
    pendiente = pendiente ? `${pendiente} ${pieza}` : pieza;
    if (!PARTICULAS.has(pieza.toLowerCase())) {
      apellidos.push(pendiente);
      pendiente = '';
    }
  }
  if (pendiente) apellidos.push(pendiente);
  return [(apellidos[0] || '').slice(0, 60), apellidos.slice(1).join(' ').slice(0, 60)];
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />{!visible && <path d="m4 4 16 16" />}</svg>;
}

function GoogleButton({ className = '', disabled, onClick }: { className?: string; disabled?: boolean; onClick: () => void }) {
  return <button className={`google-sign-in ${className}`.trim()} type="button" disabled={disabled} onClick={onClick}><img src="/img/google-g.svg" alt="" aria-hidden="true" />Continuar con Google</button>;
}

function Field({ label, name, type = 'text', autoComplete, required = true, minLength, maxLength, hint, placeholder }: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  hint?: string;
  placeholder?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="form-field">
      <span>{label}{!required && <small>Opcional</small>}</span>
      <input name={name} type={type} placeholder={placeholder} autoComplete={autoComplete} required={required} minLength={minLength} maxLength={maxLength} aria-describedby={hintId}
        inputMode={type === 'tel' ? 'numeric' : undefined}
        pattern={type === 'tel' ? '[0-9]{8}' : name === 'nombre' || name === 'apellidos' ? '[\\p{L}\\p{M} ]+' : type === 'email' ? '[^\\s@]+@[^\\s@]+\\.[^\\s@]+' : undefined}
        max={type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined}
        onInput={event => {
          const input = event.currentTarget;
          if (type === 'tel') input.value = input.value.replace(/[^0-9]/g, '').slice(0, 8);
          if (name === 'nombre' || name === 'apellidos') input.value = input.value.replace(/[^\p{L}\p{M} ]/gu, '');
        }} />
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}

export function AuthForm({ mode, nextPath = null, googleComplete = false, googleError = null }: { mode: 'login' | 'register'; nextPath?: string | null; googleComplete?: boolean; googleError?: string | null }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const registerFormRef = useRef<HTMLFormElement>(null);
  const googleRefreshStarted = useRef(false);

  useEffect(() => {
    if (!googleError) return;
    setError(googleError === 'account_not_linked' ? 'Este correo ya tiene una cuenta. Ingresá con tu contraseña y vinculá Google desde tu perfil.' : 'No pudimos completar el acceso con Google. Intentá nuevamente.');
  }, [googleError]);

  useEffect(() => {
    if (mode !== 'login' || !googleComplete || !hydrated || googleRefreshStarted.current) return;
    googleRefreshStarted.current = true;
    let active = true;
    setSubmitting(true);
    setError(null);
    void apiRequest<LoginResponse>('/auth/refresh', { method: 'POST' })
      .then((response) => {
        if (!active) return;
        const authenticatedSession = toAuthenticatedSession(response);
        saveSession(authenticatedSession);
        router.replace(getPostLoginDestination(authenticatedSession, nextPath));
      })
      .catch((caught) => {
        if (active) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (active) setSubmitting(false);
      });
    return () => { active = false; };
  }, [googleComplete, hydrated, mode, nextPath, router]);

  function beginGoogleAuthentication() {
    const target = new URL(`${API_URL}/auth/google`);
    target.searchParams.set('next', nextPath || '/mi-panel');
    window.location.assign(target.toString());
  }

  function changeRegisterStep(step: 1 | 2) {
    setError(null);
    setRegisterStep(step);
    window.requestAnimationFrame(() => {
      registerFormRef.current?.querySelector<HTMLElement>(`[data-step="${step}"] h2`)?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    if (mode === 'register') {
      const inputs = form.querySelectorAll<HTMLInputElement>(registerStep === 1 ? '[data-step="1"] input' : 'input');
      const invalid = Array.from(inputs).find((input) => !input.checkValidity());
      if (invalid) {
        const step = invalid.closest('[data-step]')?.getAttribute('data-step') === '1' ? 1 : 2;
        changeRegisterStep(step);
        window.requestAnimationFrame(() => invalid.reportValidity());
        return;
      }
      if (registerStep === 1) {
        changeRegisterStep(2);
        return;
      }
    }
    const values = new FormData(form);
    const password = String(values.get('password') || '');
    const confirmation = String(values.get('password_confirmation') || '');

    if (mode === 'register' && password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const correo = String(values.get('correo') || '').trim().toLowerCase();
      if (mode === 'login') {
        const response = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: { email: correo, password } });
        const authenticatedSession = toAuthenticatedSession(response);
        const destination = getPostLoginDestination(authenticatedSession, nextPath);
        saveSession(authenticatedSession);
        router.replace(destination);
      } else {
        const payload = new FormData();
        payload.set('name', String(values.get('nombre') || '').trim());
        const [paterno, materno] = separarApellidos(String(values.get('apellidos') || ''));
        payload.set('paternalSurname', paterno);
        payload.set('maternalSurname', materno);
        payload.set('email', correo);
        payload.set('phone', String(values.get('telefono') || '').trim());
        payload.set('dateOfBirth', String(values.get('fecha_nacimiento') || ''));
        payload.set('password', password);
        await apiRequest<RegisterResponse>('/auth/register', { method: 'POST', body: payload, timeoutMs: 30000 });
        const login = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: { email: correo, password } });
        const authenticatedSession = toAuthenticatedSession(login);
        form.reset();
        saveSession(authenticatedSession);
        router.replace(getPostLoginDestination(authenticatedSession, nextPath));
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const isLogin = mode === 'login';

  if (isLogin) {
    return (
      <main className="login-page">
        <div className="login-shell">
          <div className="login-card">
            <LoginStory />

            <section className="login-panel" aria-labelledby="login-title">
              <div className="login-panel__inner">
                <div className="login-panel__heading"><h1 id="login-title">Qué bueno verte.</h1></div>
                <form className="login-form" method="post" onSubmit={submit} noValidate={false}>
                  {error && <div className="login-form__alert" role="alert">{error}</div>}
                  <div className="login-field">
                    <label htmlFor="login-email">Correo electrónico</label>
                    <div className="login-control"><span className="login-control__icon"><MailIcon /></span><input id="login-email" name="correo" type="email" autoComplete="email" placeholder="nombre@correo.com" required maxLength={150} inputMode="email" /></div>
                  </div>
                  <div className="login-field">
                    <label htmlFor="login-password">Contraseña</label>
                    <div className="login-control"><span className="login-control__icon"><LockIcon /></span><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" required maxLength={128} /><button className="password-toggle" type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)}><EyeIcon visible={showPassword} /></button></div>
                  </div>
                  <GoogleButton className="login-submit" disabled={!hydrated || submitting} onClick={beginGoogleAuthentication} />
                  <button className="button button-dark login-submit" type="submit" disabled={!hydrated || submitting}>{submitting ? 'Ingresando…' : 'Ingresar'}</button>
                </form>
                <p className="login-register">¿Todavía no tienes una cuenta? <Link href={nextPath ? `/registro?next=${encodeURIComponent(nextPath)}` : '/registro'}>Regístrate</Link></p>
                <Link className="login-return-link" href="/"><span aria-hidden="true">←</span>Volver al inicio</Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page register-page">
      <div className="login-shell">
        <div className="login-card register-card">
          <LoginStory />
          <section className="login-panel register-panel" aria-labelledby="register-title">
            <div className="login-panel__inner">
          <div className="login-panel__heading"><h1 id="register-title">Únete a la comunidad</h1></div>

          {success ? (
            <div className="form-success" role="status"><span aria-hidden="true">✓</span><h2>Cuenta creada</h2><p>{success}</p><Link className="button button-dark" href="/login">Ingresar ahora</Link></div>
          ) : (
            <form className="login-form auth-form register-steps-form" ref={registerFormRef} onSubmit={submit} noValidate>
              <div className="register-step-pages">
              <section className="auth-form-section" data-step="1" hidden={registerStep !== 1}><header><div><h2 tabIndex={-1}>Datos personales</h2><p>Completa lo esencial para crear tu perfil.</p></div></header>
                <div className="form-row"><Field label="Nombre" name="nombre" placeholder="Ej.: María" autoComplete="given-name" minLength={2} maxLength={60} /><Field label="Apellidos" name="apellidos" placeholder="Ej.: Pérez Gutiérrez" autoComplete="family-name" required={false} maxLength={120} /></div>
                <div className="form-row"><Field label="Teléfono" name="telefono" type="tel" placeholder="Ej.: 70000000" autoComplete="tel" minLength={8} maxLength={8} /><Field label="Fecha de nacimiento" name="fecha_nacimiento" type="date" autoComplete="bday" /></div>
              </section>
              <section className="auth-form-section" data-step="2" hidden={registerStep !== 2}>
                <Field label="Correo electrónico" name="correo" type="email" placeholder="Ej.: maria@correo.com" autoComplete="email" maxLength={150} />
                <div className="form-row"><Field label="Contraseña" name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? undefined : 12} maxLength={128} hint={isLogin ? undefined : 'Mínimo 12 caracteres.'} /><Field label="Confirmar contraseña" name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} /></div>
              </section>
              </div>
              {error && <div className="form-error" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
              <div className="register-step-actions">
                {registerStep === 2 && <button className="button register-back" type="button" disabled={submitting} onClick={() => changeRegisterStep(1)}>Volver</button>}
                {registerStep === 2 && <GoogleButton className="login-submit" disabled={submitting} onClick={beginGoogleAuthentication} />}
                <button className="button button-dark login-submit submit-button" type="submit" disabled={submitting}>{submitting ? 'Procesando...' : registerStep === 1 ? 'Continuar' : 'Crear mi cuenta'}</button>
              </div>
            </form>
          )}

          {!success && <p className="login-register">¿Ya eres parte de la House? <Link href="/login">Ingresa</Link></p>}
          <Link className="login-return-link" href="/"><span aria-hidden="true">←</span>Volver a la House</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
