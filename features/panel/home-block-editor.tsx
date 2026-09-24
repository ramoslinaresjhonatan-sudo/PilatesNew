'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invalidateGalleryContent, useApiResource } from '@/hooks/use-api-resource';
import { apiRequest, getErrorMessage, safeAssetUrl } from '@/lib/http-client';
import type { ImageAsset, LandingSection } from '@/lib/types';

type Content = { titulo: string; subtitulo: string; descripcion: string };
type Props = { sectionKey: string; heading: string; defaults: Content; imageSlot?: number; className?: string };
const socials = ['instagram', 'facebook', 'tiktok', 'whatsapp'];
export function HomeBlockEditor({ sectionKey, heading, defaults, imageSlot, className = '' }: Props) {
  const sections = useApiResource<LandingSection[]>('/landing/seccion', true);
  const images = useApiResource<ImageAsset[]>('/imagen', true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaults);
  const [picked, setPicked] = useState('');
  const [alt, setAlt] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const [search, setSearch] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const isSocial = sectionKey === 'FOOTER_REDES';
  const section = sections.data?.find(item => item.clave === sectionKey);
  const group = sections.data?.find(item => item.clave === (imageSlot === -1 ? 'HERO_IMAGEN' : 'THE_HOUSE_RITUAL'));
  const published = group?.imagenes?.find((item, index) => (item.orden ?? index) === Math.max(0, imageSlot ?? 0));
  const selected = images.data?.find(item => item.id === picked) ?? (published?.id === picked ? published : undefined);
  function announce(state: string) { window.dispatchEvent(new CustomEvent('home-editor-state', { detail: state })); }
  function change() { setDirty(true); setDiscard(false); announce('Cambios sin publicar'); }
  function close() { if (busy) return; if (dirty) { setDiscard(true); return; } setOpen(false); }
  function show() {
    setForm({ titulo: section?.titulo ?? defaults.titulo, subtitulo: section?.subtitulo ?? defaults.subtitulo, descripcion: section?.descripcion ?? defaults.descripcion });
    setPicked(imageSlot === undefined ? '' : published?.id ?? ''); setAlt(published?.texto_alt ?? '');
    let stored: Array<{ id: string; href: string }> = [];
    try { const parsed: unknown = JSON.parse(section?.descripcion || '[]'); if (Array.isArray(parsed)) stored = parsed; } catch { /* Use defaults for legacy content. */ }
    setLinks(Object.fromEntries(socials.map(id => [id, stored.find(item => item.id === id)?.href ?? (id === 'instagram' ? 'https://www.instagram.com/pilateshouse.hotpilates/' : '')])));
    setDirty(false); setError(''); setDiscard(false); setSearch(''); setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const trigger = opener.current;
    dialog.current?.focus();
    return () => { document.body.style.overflow = previous; trigger?.focus(); };
  }, [open]);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [open, dirty]);
  async function upload(item?: File) {
    if (!item) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(item.type) || item.size > 5 * 1024 * 1024) { setError('Usá JPG, PNG o WebP de hasta 5 MB.'); return; }
    if (alt.trim().length < 2) { setError('Primero escribí una descripción de la imagen.'); return; }
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('imagen', item); body.append('modulo', 'landing'); body.append('texto_alt', alt.trim());
      const response = await apiRequest<{ imagen: { id: string } }>('/imagen', { method: 'POST', authenticated: true, body });
      setPicked(response.imagen.id); images.retry(); change();
    } catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); if (file.current) file.current.value = ''; }
  }
  async function publish() {
    setBusy(true); setError(''); announce('Publicando…');
    try {
      await apiRequest('/landing/editor/bloque', { method: 'PUT', authenticated: true, body: {
        clave: sectionKey, ...form,
        ...(isSocial ? { descripcion: JSON.stringify(socials.map(id => ({ id, href: (links[id] || '').trim() }))) } : {}),
        ...(picked ? { imagen_id: picked, texto_alt: alt.trim() } : {}),
      } });
      setDirty(false); setOpen(false); invalidateGalleryContent(); announce('Publicado');
    } catch (reason) { setError(getErrorMessage(reason)); announce('No se pudo publicar; revisá el bloque'); } finally { setBusy(false); }
  }
  return <><button ref={opener} className={`web-image-cloud ${className}`} type="button" disabled={sections.loading || Boolean(sections.error)} onClick={show}>✎ Editar {heading}</button>
    {open && createPortal(<div className="web-image-modal" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([hidden]), textarea:not(:disabled), select:not(:disabled), a[href]') || []).filter(item => item.getClientRects().length);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header><div><p className="web-image-modal__eyebrow">EDITOR DE PÁGINA PRINCIPAL</p><h2 id={titleId}>{heading}</h2></div><button type="button" aria-label="Cerrar editor" disabled={busy} onClick={close}>×</button></header>
        <p>Los cambios se mostrarán en la landing al pulsar <strong>Publicar cambios</strong>.</p>
        <form onSubmit={event => { event.preventDefault(); void publish(); }}>
          <fieldset disabled={busy} className="home-editor-fields">
            <div className="web-content-form">
              {isSocial ? socials.map(id => <label key={id}>{id}<input type="url" pattern="https://.*" placeholder="https://…" value={links[id] || ''} onChange={event => { setLinks({ ...links, [id]: event.target.value }); change(); }} /></label>) : <>
                <label>Título<input required minLength={2} maxLength={150} value={form.titulo} onChange={event => { setForm({ ...form, titulo: event.target.value }); change(); }} /></label>
                <label>Subtítulo<input maxLength={200} value={form.subtitulo} onChange={event => { setForm({ ...form, subtitulo: event.target.value }); change(); }} /></label>
                {sectionKey === 'HERO_TEXTO' ? [0, 1].map(index => <label key={index}>Texto del botón {index + 1}<input required maxLength={60} value={form.descripcion.split('|')[index]?.trim() || ''} onChange={event => { const labels = form.descripcion.split('|'); labels[index] = event.target.value; setForm({ ...form, descripcion: labels.join('|') }); change(); }} /></label>) : <label>Descripción<textarea rows={3} maxLength={5000} value={form.descripcion} onChange={event => { setForm({ ...form, descripcion: event.target.value }); change(); }} /></label>}
              </>}
              {isSocial && <small>Dejá un enlace vacío para desactivarlo. Usá direcciones completas https://.</small>}
            </div>
            {imageSlot !== undefined && <>
              <p><strong>{picked === published?.id ? 'Imagen publicada' : 'Imagen pendiente de publicar'}</strong></p>
              <p>Recomendado: horizontal, 1920 × 1080 px. {imageSlot === -1 ? 'La portada recorta los bordes según la pantalla; mantené el sujeto en el centro.' : 'En escritorio se recorta para llenar el bloque; en móvil se muestra la proporción completa.'}</p>
              {selected && <div className={'home-image-crops' + (imageSlot !== -1 ? ' is-ritual' : '')}><figure><img src={safeAssetUrl(selected.url, '', selected.id)} alt={alt} /><figcaption>Encuadre horizontal orientativo</figcaption></figure><figure><img src={safeAssetUrl(selected.url, '', selected.id)} alt={alt} /><figcaption>Encuadre móvil orientativo</figcaption></figure></div>}
              <label className="web-content-form">Descripción de la imagen (texto alternativo)<input required={Boolean(picked)} minLength={2} maxLength={180} value={alt} onChange={event => { setAlt(event.target.value); change(); }} placeholder="Ej.: grupo practicando pilates en el estudio" /></label>
              <small>La descripción pertenece a la imagen y se actualiza donde se reutilice.</small>
              <div className="web-image-modal__actions"><input ref={file} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event.target.files?.[0])} /><button type="button" onClick={() => file.current?.click()}>Subir imagen · hasta 5 MB</button></div>
              <p>Subir agrega la foto a la biblioteca. Cancelar no la elimina ni la publica.</p>
              <label className="web-content-form">Buscar en biblioteca<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
              {images.loading && <p role="status">Cargando biblioteca…</p>}
              {images.error && <p role="alert">{images.error} <button type="button" onClick={images.retry}>Reintentar</button></p>}
              <div className="web-image-picker">{images.data?.filter(item => item.administrable !== false && item.estado === 'ACTIVO' && `${item.texto_alt || ''} ${item.descripcion || ''}`.toLowerCase().includes(search.toLowerCase())).map(item => <button type="button" key={item.id} aria-pressed={picked === item.id} aria-label={`Elegir ${item.texto_alt || 'imagen'}`} className={picked === item.id ? 'is-selected' : ''} onClick={() => { setPicked(item.id); setAlt(item.texto_alt || ''); change(); }}><img src={safeAssetUrl(item.url, '', item.id)} alt={item.texto_alt || 'Imagen de biblioteca'} /></button>)}</div>
              {!images.loading && !images.error && !images.data?.some(item => item.administrable !== false && item.estado === 'ACTIVO' && `${item.texto_alt || ''} ${item.descripcion || ''}`.toLowerCase().includes(search.toLowerCase())) && <p>No hay imágenes para esta búsqueda. Podés subir una nueva.</p>}
            </>}
          </fieldset>
          {error && <p className="staff-error" role="alert">{error}</p>}
          {discard && <div className="home-discard" role="alert"><p>Hay cambios sin publicar. ¿Querés descartarlos?</p><button type="button" onClick={() => setDiscard(false)}>Seguir editando</button><button type="button" onClick={() => { setDirty(false); setOpen(false); announce('Cambios descartados'); }}>Descartar cambios</button></div>}
          <footer><span role="status">{busy ? 'Procesando…' : dirty ? 'Cambios sin publicar' : 'Sin cambios pendientes'}</span><button type="button" disabled={busy} onClick={close}>Cancelar</button><button className="button button-dark" type="submit" disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Publicar cambios'}</button></footer>
        </form>
      </section>
    </div>, document.body)}
  </>;
}
