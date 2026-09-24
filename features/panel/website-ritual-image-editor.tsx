'use client';

import { useMemo, useRef, useState } from 'react';
import { apiRequest, getErrorMessage, safeAssetUrl } from '@/lib/http-client';
import { useApiResource } from '@/hooks/use-api-resource';
import type { ImageAsset, LandingSection } from '@/lib/types';

const labels = ['Community', 'Movement', 'Heat', 'Recovery'];

export function WebsiteRitualImageEditor() {
  const sections = useApiResource<LandingSection[]>('/landing/seccion', true);
  const images = useApiResource<ImageAsset[]>('/imagen', true);
  const section = useMemo(() => (sections.data || []).find((item) => item.clave === 'THE_HOUSE_RITUAL'), [sections.data]);
  const [selected, setSelected] = useState<(string | undefined)[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const file = useRef<HTMLInputElement>(null); const [target, setTarget] = useState<number | null>(null);
  const current = selected.length ? selected : (section?.imagenes || []).map((image) => image.id);
  function choose(index: number, id: string) { const next = [...current]; next[index] = id; setSelected(next); }
  async function upload(index: number, input: File | null) { if (!input) return; setBusy(true); setError(''); try { const data = new FormData(); data.append('imagen', input); data.append('modulo', 'landing'); data.append('texto_alt', labels[index]); const response = await apiRequest<{ imagen: { id: string } }>('/imagen', { method: 'POST', authenticated: true, body: data }); choose(index, response.imagen.id); } catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); if (file.current) file.current.value = ''; } }
  async function save() { if (!section || current.filter(Boolean).length !== labels.length) return setError('Elegí una imagen para cada bloque.'); setBusy(true); setError(''); try { await apiRequest(`/landing/seccion/${section.id}/imagenes`, { method: 'PUT', authenticated: true, body: { imagen_ids: current } }); sections.retry(); setSelected([]); } catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); } }
  return <section className="website-social-editor website-image-editor"><header><div><p className="section-eyebrow">IMÁGENES DEL INICIO</p><h1>The House Ritual</h1><p>Elegí una imagen de Galería o subí una desde tu dispositivo para cada bloque.</p></div></header>{sections.loading || images.loading ? <p>Cargando imágenes…</p> : <>{labels.map((label, index) => <article key={label}><strong>{label}</strong><select value={current[index] || ''} onChange={(event) => choose(index, event.target.value)}><option value="">Elegir imagen de Galería</option>{(images.data || []).filter((image) => image.administrable !== false).map((image) => <option key={image.id} value={image.id}>{image.texto_alt || image.descripcion || image.id}</option>)}</select>{current[index] && <img src={safeAssetUrl((images.data || []).find((image) => image.id === current[index])?.url, '', current[index])} alt={label} />}<button type="button" className="button button-outline" disabled={busy} onClick={() => { setTarget(index); file.current?.click(); }}>Subir desde dispositivo</button></article>)}<input ref={file} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { if (target !== null) void upload(target, event.target.files?.[0] || null); }} />{error && <p className="staff-error">{error}</p>}<button type="button" className="button button-dark" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar imágenes'}</button></>}</section>;
}
