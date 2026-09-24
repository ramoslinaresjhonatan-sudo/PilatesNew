'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirm } from '@/components/confirm-dialog';
import { ResilientImage } from '@/components/resilient-image';
import { StatusState } from '@/components/status-state';
import { apiRequest, getErrorMessage, safeAssetUrl } from '@/lib/api';
import { invalidateGalleryContent } from '@/hooks/use-api-resource';
import type { ImageAsset, LandingSection } from '@/lib/types';

/** Esta sección tiene un lugar fijo dentro del bloque de comunidad; las demás se dibujan solas al final de la página principal. */
const FIXED_SECTION_KEYS = new Set(['GALERIA']);

const ORIGIN_LABELS: Record<string, string> = {
  GALERIA: 'Galería',
  BIBLIOTECA: 'Sin usar',
};

type SectionForm = { titulo: string; subtitulo: string; descripcion: string };

/** Una imagen elegida en el formulario, todavia sin subir. */
type PendingImage = { key: string; file: File; preview: string; texto_alt: string; descripcion: string };

type ImageForm = { texto_alt: string; descripcion: string };

const blankSection = (): SectionForm => ({ titulo: '', subtitulo: '', descripcion: '' });

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const blankImage = (): ImageForm => ({ texto_alt: '', descripcion: '' });

function sectionToForm(section: LandingSection): SectionForm {
  return {
    titulo: section.titulo,
    subtitulo: section.subtitulo || '',
    descripcion: section.descripcion || '',
  };
}

function imageLabel(image: ImageAsset) {
  return image.texto_alt?.trim() || image.descripcion?.trim() || 'Imagen sin título';
}

function Thumb({ image }: { image: ImageAsset }) {
  const source = safeAssetUrl(image.url, '', image.id);
  if (!source) return <span className="gallery-thumb gallery-thumb--empty" aria-hidden="true" />;
  return <span className="gallery-thumb"><ResilientImage src={source} alt={imageLabel(image)} loading="lazy" /></span>;
}

export function GalleryManager({ sections, images, imagesLoading, imagesError, retryImages, reloadSections }: {
  sections: LandingSection[];
  images: ImageAsset[];
  imagesLoading: boolean;
  imagesError: string | null;
  retryImages: () => void;
  reloadSections: () => void;
}) {
  const [tab, setTab] = useState<'sections' | 'library'>('sections');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { confirm, confirmDialog } = useConfirm();

  const [sectionDialog, setSectionDialog] = useState<{ section: LandingSection | null } | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>(blankSection);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const sectionFileInput = useRef<HTMLInputElement>(null);
  const [imagesDialog, setImagesDialog] = useState<LandingSection | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [imageForm, setImageForm] = useState<ImageForm>(blankImage);
  const [file, setFile] = useState<File | null>(null);
  const [editingImage, setEditingImage] = useState<ImageAsset | null>(null);

  const manageable = useMemo(() => images.filter((image) => image.administrable !== false), [images]);

  function reloadAll() {
    reloadSections();
    retryImages();
  }

  async function run(action: () => Promise<{ message?: string } | void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      invalidateGalleryContent();
      if (result && 'message' in result && result.message) setNotice(result.message);
      reloadAll();
      return true;
    } catch (reason) {
      setError(getErrorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ---- secciones ----
  function releasePending(items: PendingImage[]) {
    items.forEach((item) => URL.revokeObjectURL(item.preview));
  }

  function openSection(section: LandingSection | null) {
    setSectionDialog({ section });
    setSectionForm(section ? sectionToForm(section) : blankSection());
    setPending((current) => { releasePending(current); return []; });
    setError('');
  }

  function closeSection() {
    setPending((current) => { releasePending(current); return []; });
    setSectionDialog(null);
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const aceptadas: PendingImage[] = [];
    let rechazada = false;
    for (const file of Array.from(list)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) { rechazada = true; continue; }
      aceptadas.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file), texto_alt: '', descripcion: '' });
    }
    setError(rechazada ? 'Cada imagen debe ser JPG, PNG o WebP y pesar hasta 5 MB.' : '');
    if (aceptadas.length) setPending((current) => [...current, ...aceptadas]);
    if (sectionFileInput.current) sectionFileInput.current.value = '';
  }

  function updatePending(key: string, patch: Partial<PendingImage>) {
    setPending((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removePending(key: string) {
    setPending((current) => {
      const item = current.find((candidate) => candidate.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((candidate) => candidate.key !== key);
    });
  }

  async function saveSection(event: FormEvent) {
    event.preventDefault();
    const editing = sectionDialog?.section;
    const body = {
      titulo: sectionForm.titulo.trim(),
      subtitulo: sectionForm.subtitulo.trim() || null,
      descripcion: sectionForm.descripcion.trim() || null,
    };
    const nuevas = pending;
    const done = await run(async () => {
      let seccionId = editing?.id;
      if (editing) await apiRequest(`/landing/seccion/${editing.id}`, { method: 'PATCH', authenticated: true, body });
      else seccionId = (await apiRequest<{ seccion: { id: string } }>('/landing/seccion', { method: 'POST', authenticated: true, body })).seccion.id;
      if (!nuevas.length) return { message: editing ? 'Sección actualizada' : 'Sección creada' };
      /* Cada imagen se sube por separado y recien despues se enlazan todas a la seccion. */
      const subidas: string[] = [];
      for (const item of nuevas) {
        const data = new FormData();
        data.append('imagen', item.file);
        data.append('modulo', 'gallery');
        if (item.texto_alt.trim()) data.append('texto_alt', item.texto_alt.trim());
        if (item.descripcion.trim()) data.append('descripcion', item.descripcion.trim());
        const respuesta = await apiRequest<{ imagen: { id: string } }>('/imagen', { method: 'POST', authenticated: true, body: data });
        subidas.push(respuesta.imagen.id);
      }
      const previas = (editing?.imagenes || []).map((image) => image.id);
      await apiRequest(`/landing/seccion/${seccionId}/imagenes`, { method: 'PUT', authenticated: true, body: { imagen_ids: [...previas, ...subidas] } });
      return { message: nuevas.length === 1 ? 'Sección guardada con 1 imagen' : `Sección guardada con ${nuevas.length} imágenes` };
    });
    if (done) closeSection();
  }

  async function toggleSection(section: LandingSection) {
    const visible = section.estado !== 'ACTIVO';
    await run(() => apiRequest(`/landing/seccion/${section.id}/visibilidad`, { method: 'PATCH', authenticated: true, body: { visible } }));
  }

  async function annulSection(section: LandingSection) {
    const accepted = await confirm({
      title: `¿Anular “${section.titulo}”?`,
      description: FIXED_SECTION_KEYS.has(section.clave)
        ? 'Es la sección que se muestra en el bloque de comunidad: al anularla ese bloque queda vacío. Sus imágenes se conservan.'
        : 'Dejará de mostrarse en la página principal. Sus imágenes se conservan en la biblioteca.',
      confirmLabel: 'Anular sección',
      tone: 'danger',
    });
    if (!accepted) return;
    await run(() => apiRequest(`/landing/seccion/${section.id}`, { method: 'DELETE', authenticated: true }));
  }

  function openImages(section: LandingSection) {
    setImagesDialog(section);
    setPicked((section.imagenes || []).map((image) => image.id));
    setError('');
  }

  function togglePicked(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function saveSectionImages() {
    if (!imagesDialog) return;
    const done = await run(() => apiRequest(`/landing/seccion/${imagesDialog.id}/imagenes`, { method: 'PUT', authenticated: true, body: { imagen_ids: picked } }));
    if (done) setImagesDialog(null);
  }

  // ---- biblioteca ----
  async function uploadImage(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError('Elegí una imagen para subir.');
    const data = new FormData();
    data.append('imagen', file);
    data.append('modulo', 'gallery');
    if (imageForm.texto_alt.trim()) data.append('texto_alt', imageForm.texto_alt.trim());
    if (imageForm.descripcion.trim()) data.append('descripcion', imageForm.descripcion.trim());
    const done = await run(() => apiRequest('/imagen', { method: 'POST', authenticated: true, body: data }));
    if (done) { setUploadOpen(false); setFile(null); setImageForm(blankImage()); }
  }

  function openImageEdit(image: ImageAsset) {
    setEditingImage(image);
    setImageForm({ texto_alt: image.texto_alt || '', descripcion: image.descripcion || '' });
    setError('');
  }

  async function saveImage(event: FormEvent) {
    event.preventDefault();
    if (!editingImage) return;
    const done = await run(() => apiRequest(`/imagen/${editingImage.id}`, {
      method: 'PATCH',
      authenticated: true,
      body: { texto_alt: imageForm.texto_alt.trim() || null, descripcion: imageForm.descripcion.trim() || null },
    }));
    if (done) setEditingImage(null);
  }

  async function deleteImage(image: ImageAsset) {
    const accepted = await confirm({
      title: `¿Eliminar “${imageLabel(image)}”?`,
      description: 'Se elimina la imagen y su archivo de forma definitiva. No se puede deshacer.',
      confirmLabel: 'Eliminar imagen',
      tone: 'danger',
    });
    if (!accepted) return;
    await run(() => apiRequest(`/imagen/${image.id}`, { method: 'DELETE', authenticated: true }));
  }

  const selectableImages = manageable;

  return <section className="connected-manager gallery-manager">
    {error && <p className="staff-error" role="alert">{error}</p>}
    {notice && !error && <p className="gallery-notice" role="status">{notice}</p>}

    <div className="staff-tabs" role="tablist" aria-label="Contenido de la landing">
      <button type="button" role="tab" aria-selected={tab === 'sections'} className={tab === 'sections' ? 'is-active' : ''} onClick={() => setTab('sections')}>Secciones</button>
      <button type="button" role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}>Biblioteca</button>
    </div>

    {tab === 'sections' && <>
      <header className="staff-manager__header">
        <nav className="gallery-manager__actions" aria-label="Acciones de galería">
          <a className="button button-outline" href="/panel/gestion/galeria/web" aria-label="Editar página principal">Editar web</a>
          <button className="button button-dark" type="button" disabled={busy} onClick={() => openSection(null)}>+ Nueva sección</button>
        </nav>
      </header>
      <div className="section-content-list">{sections.length ? sections.map((section) => <article key={section.id}>
        <header>
          <div>
            <h3>{section.titulo}</h3>
            <p>{section.descripcion || section.subtitulo || 'Sin descripción'}</p>
            {section.estado === 'ACTIVO'
              ? <small className="gallery-published">{FIXED_SECTION_KEYS.has(section.clave) ? 'Se muestra en la página principal, dentro del bloque de comunidad.' : 'Se muestra en la página principal como bloque propio.'}</small>
              : <small className="gallery-warning">No se muestra en la página principal. Tocá “Publicar” para que aparezca.</small>}
          </div>
          <small className={`state-pill ${section.estado === 'ACTIVO' ? 'is-success' : 'is-danger'}`}>{section.estado}</small>
        </header>
        <div className="section-content-list__images">
          {(section.imagenes || []).slice(0, 6).map((image) => <Thumb key={image.id} image={image} />)}
          {!(section.imagenes || []).length && <span>Sin imágenes relacionadas</span>}
        </div>
        <nav className="section-content-list__actions">
          <button className="text-link" type="button" aria-label={`Editar textos de ${section.titulo}`} disabled={busy} onClick={() => openSection(section)}>Editar</button>
          <button className="text-link" type="button" aria-label={`Gestionar imágenes de ${section.titulo}`} disabled={busy} onClick={() => openImages(section)}>Fotos ({(section.imagenes || []).length})</button>
          <button className="text-link" type="button" disabled={busy} onClick={() => void toggleSection(section)}>{section.estado === 'ACTIVO' ? 'Ocultar' : 'Publicar'}</button>
          {section.estado === 'ACTIVO' && <button className="text-link section-content-list__danger" type="button" disabled={busy} onClick={() => void annulSection(section)}>Anular</button>}
        </nav>
      </article>) : <p className="staff-empty">Todavía no hay secciones creadas.</p>}</div>
    </>}

    {tab === 'library' && <>
      <header className="staff-manager__header">
        <div><h2>Biblioteca de imágenes</h2></div>
        <button className="button button-dark" type="button" disabled={busy} onClick={() => { setUploadOpen(true); setFile(null); setImageForm(blankImage()); setError(''); }}>+ Subir imagen</button>
      </header>
      {imagesLoading && <StatusState kind="loading" title="Cargando biblioteca" description="Consultando las imágenes almacenadas." />}
      {imagesError && <StatusState kind="error" title="No pudimos cargar las imágenes" description={imagesError} actionLabel="Reintentar" onAction={retryImages} />}
      {!imagesLoading && !imagesError && <div className="media-library">{manageable.length ? manageable.map((image) => {
        const inUse = (image.usos_total ?? 0) > 0;
        return <figure key={image.id}>
          <Thumb image={image} />
          <figcaption>
            <strong>{imageLabel(image)}</strong>
            <span>{ORIGIN_LABELS[image.origen || 'BIBLIOTECA'] || image.origen}</span>
            <nav>
                  <button className="text-link" type="button" disabled={busy} onClick={() => openImageEdit(image)}>Editar</button>
                  <button className="text-link section-content-list__danger" type="button" disabled={busy || inUse} title={inUse ? 'Quitala de la sección antes de eliminarla' : undefined} onClick={() => void deleteImage(image)}>Eliminar</button>
            </nav>
          </figcaption>
        </figure>;
      }) : <p className="staff-empty">No hay imágenes de galería.</p>}</div>}
    </>}

    {sectionDialog && typeof document !== 'undefined' && createPortal(
      <div className="staff-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeSection(); }}>
        <form className="staff-form staff-modal" onSubmit={saveSection} role="dialog" aria-modal="true" aria-labelledby="section-form-title">
          <header><div><h2 id="section-form-title">{sectionDialog.section ? 'Editar sección' : 'Nueva sección'}</h2><p>Poné un título, una descripción y sumá las fotos que querés mostrar.</p></div><button className="staff-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={closeSection}>×</button></header>
          <div className="staff-form__body">
            <label>Título<input required placeholder="Ej.: Así se vive House" minLength={2} maxLength={150} value={sectionForm.titulo} onChange={(event) => setSectionForm({ ...sectionForm, titulo: event.target.value })} /></label>
            <label>Subtítulo <small className="field-hint">Opcional</small><input placeholder="Ej.: Nuestros espacios" maxLength={200} value={sectionForm.subtitulo} onChange={(event) => setSectionForm({ ...sectionForm, subtitulo: event.target.value })} /></label>
            <label>Descripción <small className="field-hint">Opcional</small><textarea placeholder="Contá de qué se trata esta sección" value={sectionForm.descripcion} onChange={(event) => setSectionForm({ ...sectionForm, descripcion: event.target.value })} /></label>

            <div className="section-photos">
              <div className="section-photos__head">
                <strong>Fotos de la sección</strong>
                <button className="button button-outline" type="button" disabled={busy} onClick={() => sectionFileInput.current?.click()}>+ Agregar fotos</button>
              </div>
              <input ref={sectionFileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => addFiles(event.target.files)} />
              {sectionDialog.section && (sectionDialog.section.imagenes || []).length > 0 && (
                <p className="field-hint">Esta sección ya tiene {(sectionDialog.section.imagenes || []).length} foto{(sectionDialog.section.imagenes || []).length === 1 ? '' : 's'}. Las que agregues se suman al final.</p>
              )}
              {pending.length === 0
                ? <p className="section-photos__empty">Todavía no elegiste fotos. JPG, PNG o WebP, hasta 5 MB cada una.</p>
                : <ul className="section-photos__list">{pending.map((item) => <li key={item.key}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Vista previa local del archivo elegido. */}
                    <img className="section-photos__thumb" src={item.preview} alt={item.texto_alt || item.file.name} />
                    <label>Texto alternativo<input placeholder="Ej.: Sala de reformers con luz natural" maxLength={180} value={item.texto_alt} onChange={(event) => updatePending(item.key, { texto_alt: event.target.value })} /></label>
                    <label>Descripción<input placeholder="Ej.: Foto tomada en la clase de la mañana" maxLength={255} value={item.descripcion} onChange={(event) => updatePending(item.key, { descripcion: event.target.value })} /></label>
                    <button type="button" className="section-photos__remove" aria-label={`Quitar ${item.file.name}`} disabled={busy} onClick={() => removePending(item.key)}>×</button>
                  </li>)}</ul>}
            </div>

            {error && <p className="staff-error" role="alert">{error}</p>}
          </div>
          <footer><button className="text-link" type="button" disabled={busy} onClick={closeSection}>Cancelar</button><button className="button button-dark" disabled={busy}>{busy ? 'Guardando…' : sectionDialog.section ? 'Guardar cambios' : 'Crear sección'}</button></footer>
        </form>
      </div>, document.body)}

    {imagesDialog && typeof document !== 'undefined' && createPortal(
      <div className="staff-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setImagesDialog(null); }}>
        <div className="staff-form staff-modal" role="dialog" aria-modal="true" aria-labelledby="section-images-title">
          <header><div><h2 id="section-images-title">Imágenes de {imagesDialog.clave}</h2><p>Marcá las que se publican. El orden de selección es el orden en que se muestran.</p></div><button className="staff-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={() => setImagesDialog(null)}>×</button></header>
          <div className="staff-form__body">
            <p className="gallery-notice">{picked.length} {picked.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}</p>
            <div className="gallery-picker">{selectableImages.length ? selectableImages.map((image) => {
              const position = picked.indexOf(image.id);
              return <label key={image.id} className={position >= 0 ? 'is-picked' : ''}>
                <input type="checkbox" checked={position >= 0} onChange={() => togglePicked(image.id)} />
                <Thumb image={image} />
                <span>{imageLabel(image)}</span>
                {position >= 0 && <b>{position + 1}</b>}
              </label>;
            }) : <p className="staff-empty">La biblioteca no tiene imágenes disponibles. Subí una desde la pestaña Biblioteca.</p>}</div>
            {error && <p className="staff-error" role="alert">{error}</p>}
          </div>
          <footer><button className="text-link" type="button" disabled={busy} onClick={() => setImagesDialog(null)}>Cancelar</button><button className="button button-dark" type="button" disabled={busy} onClick={() => void saveSectionImages()}>{busy ? 'Guardando…' : 'Guardar imágenes'}</button></footer>
        </div>
      </div>, document.body)}

    {(uploadOpen || editingImage) && typeof document !== 'undefined' && createPortal(
      <div className="staff-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setUploadOpen(false); setEditingImage(null); } }}>
        <form className="staff-form staff-modal" onSubmit={editingImage ? saveImage : uploadImage} role="dialog" aria-modal="true" aria-labelledby="image-form-title">
          <header><div><h2 id="image-form-title">{editingImage ? 'Editar imagen' : 'Subir imagen'}</h2><p>{editingImage ? 'El archivo no cambia; se editan sus datos.' : 'JPG, PNG o WebP · máximo 5 MB.'}</p></div><button className="staff-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={() => { setUploadOpen(false); setEditingImage(null); }}>×</button></header>
          <div className="staff-form__body">
            {!editingImage && <label>Archivo<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const chosen = event.target.files?.[0] || null;
              if (chosen && chosen.size > 5 * 1024 * 1024) { setError('La imagen supera los 5 MB.'); event.target.value = ''; return; }
              setError('');
              setFile(chosen);
            }} /><small className="field-hint">{file ? file.name : 'Todavía no elegiste ninguna.'}</small></label>}
            <label>Texto alternativo<input placeholder="Ej.: Sala de reformers con luz natural" maxLength={180} value={imageForm.texto_alt} onChange={(event) => setImageForm({ ...imageForm, texto_alt: event.target.value })} /><small className="field-hint">Describe la imagen para quien no puede verla.</small></label>
            <label>Descripción <small className="field-hint">Opcional</small><input placeholder="Ej.: Foto tomada en la clase de la mañana" maxLength={255} value={imageForm.descripcion} onChange={(event) => setImageForm({ ...imageForm, descripcion: event.target.value })} /></label>
            {error && <p className="staff-error" role="alert">{error}</p>}
          </div>
          <footer><button className="text-link" type="button" disabled={busy} onClick={() => { setUploadOpen(false); setEditingImage(null); }}>Cancelar</button><button className="button button-dark" disabled={busy}>{busy ? 'Guardando…' : editingImage ? 'Guardar cambios' : 'Subir imagen'}</button></footer>
        </form>
      </div>, document.body)}

    {confirmDialog}
  </section>;
}
