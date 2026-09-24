/* eslint-disable @next/next/no-img-element -- La vista previa usa una URL local creada por el navegador. */
'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { updateOwnProfile } from '@/lib/client-api';
import { useApiResource, invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { saveSession } from '@/lib/auth';
import { getFullName } from '@/lib/format';
import type { AuthSession, ProfileResponse } from '@/lib/types';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function ProfileEditorModal({
  session,
  open,
  onClose,
  onUpdated,
}: {
  session: AuthSession;
  profile: ProfileResponse | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const profileResource = useApiResource<ProfileResponse>(open ? '/perfil' : null, true, { staleTimeMs: 0, maxAgeMs: 0 });
  const profile = profileResource.data;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarPreviewRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, open]);

  useEffect(() => () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
  }, []);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setError(null);
    if (!file) {
      setAvatar(null);
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = null;
      setAvatarPreview(null);
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type) || file.size > MAX_AVATAR_BYTES) {
      event.target.value = '';
      setAvatar(null);
      setError('La foto debe ser JPG, PNG o WebP y pesar como máximo 2 MB.');
      return;
    }
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    const preview = URL.createObjectURL(file);
    avatarPreviewRef.current = preview;
    setAvatarPreview(preview);
    setAvatar(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !profile) return;
    const values = new FormData(event.currentTarget);
    if (!avatar) values.delete('avatar');
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateOwnProfile(values);
      const fullName = getFullName(updated.usuario);
      saveSession({ ...session, user: { ...session.user, nombre: fullName || updated.usuario.nombre } });
      setSuccess('Tu perfil fue actualizado correctamente.');
      invalidateApiResourcesByPath('/perfil');
      onUpdated();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function linkGoogle() {
    if (linkingGoogle) return;
    setLinkingGoogle(true);
    setError(null);
    try {
      const response = await apiRequest<{ data: { authorizationUrl: string } }>('/auth/google/link/start', { method: 'POST', authenticated: true });
      const target = new URL(response.data.authorizationUrl);
      if (target.origin !== 'https://accounts.google.com') throw new Error('La dirección de Google no es válida.');
      window.location.assign(target.toString());
    } catch (caught) {
      setError(getErrorMessage(caught));
      setLinkingGoogle(false);
    }
  }

  if (!open || typeof document === 'undefined') return null;
  const user = profile?.usuario;
  const initials = (user ? getFullName(user) : session.user.nombre).split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

  return createPortal(
    <div className="profile-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <header><div><span>MI CUENTA HOUSE</span><h2 id="profile-modal-title">Editar perfil</h2></div><button ref={closeRef} type="button" aria-label="Cerrar edición de perfil" onClick={onClose}>×</button></header>
        {!profile ? <div className="profile-modal__empty"><p>{profileResource.loading ? 'Cargando tus datos?' : profileResource.error || 'No pudimos cargar tu perfil.'}</p>{profileResource.error && <button type="button" onClick={profileResource.retry}>Reintentar</button>}</div> : (
          <form onSubmit={submit}>
            <div className="profile-modal__avatar">
              <div>{avatarPreview ? <img src={avatarPreview} alt="Vista previa de tu nueva foto" /> : <span aria-hidden="true">{initials || 'PH'}</span>}</div>
              <label><strong>Cambiar foto</strong><span>JPG, PNG o WebP · Máximo 2 MB</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} /></label>
            </div>
            <div className="profile-modal__grid">
              <label><span>Nombre</span><input name="nombre" placeholder="Ej.: María" defaultValue={user?.nombre || ''} minLength={2} maxLength={60} required autoComplete="given-name" /></label>
              <label><span>Apellido paterno</span><input name="apellido_paterno" placeholder="Ej.: Pérez" defaultValue={user?.apellido_paterno || ''} maxLength={60} autoComplete="family-name" /></label>
              <label><span>Apellido materno</span><input name="apellido_materno" placeholder="Ej.: Gutiérrez" defaultValue={user?.apellido_materno || ''} maxLength={60} autoComplete="additional-name" /></label>
              <label><span>Teléfono</span><input name="telefono" type="tel" placeholder="Ej.: 70000000" defaultValue={user?.telefono || ''} maxLength={25} autoComplete="tel" /></label>
              <label className="profile-modal__wide"><span>Correo electrónico</span><input value={user?.correo || session.user.correo} readOnly aria-readonly="true" /></label>
            </div>
            {error && <p className="profile-modal__message profile-modal__message--error" role="alert">{error}</p>}
            {success && <p className="profile-modal__message profile-modal__message--success" role="status">{success}</p>}
            <footer><button type="button" onClick={onClose}>Cancelar</button><button type="button" disabled={submitting || linkingGoogle} onClick={() => void linkGoogle()}>{linkingGoogle ? 'Abriendo Google…' : 'Vincular Google'}</button><button type="submit" disabled={submitting || linkingGoogle}>{submitting ? 'Guardando…' : 'Guardar cambios'}</button></footer>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}
