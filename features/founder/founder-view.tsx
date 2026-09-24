'use client';

import { StatusState } from '@/components/status-state';
import { ResilientImage } from '@/components/resilient-image';
import { useApiResource } from '@/hooks/use-api-resource';
import { useRotatingIndex } from '@/hooks/use-rotating-index';
import { safeAssetUrl } from '@/lib/api';
import { getFullName } from '@/lib/format';
import type { Coach } from '@/lib/types';

export function FounderView() {
  const request = useApiResource<Coach[]>('/coach?visible_landing=true');
  const coaches = request.data || [];
  const coach = coaches.find((item) => /vaness?a/.test(getFullName(item.usuario).toLocaleLowerCase('es'))) || coaches[0];
  const images = (coach?.imagenes || []).map((image) => ({ ...image, src:safeAssetUrl(image.url, '', image.id) })).filter((image) => image.src);
  const featuredImageIndex = useRotatingIndex(images.length, 6_500);
  const featuredImage = images[featuredImageIndex];

  return (
    <section className="founder-page" aria-label="Historia de la fundadora">
      {request.loading && <StatusState kind="loading" title="Cargando el perfil" description="Un momento, estamos cargando el perfil." />}
      {request.error && <StatusState kind="error" title="No pudimos cargar el perfil" description={request.error} actionLabel="Reintentar" onAction={request.retry} />}
      {!request.loading && !request.error && !coach && <StatusState title="Perfil no publicado" description="Todavía no hay un perfil publicado para mostrar." />}

      {coach && <>
        <div className="founder-page__intro">
          <div className={`founder-page__image${featuredImage ? '' : ' founder-page__image--empty'}`}>{featuredImage && <ResilientImage key={featuredImage.id} src={featuredImage.src} alt={featuredImage.texto_alt || getFullName(coach.usuario)} />}</div>
          <div className="founder-page__copy">
            <span>SU HISTORIA</span>
            <h2>{getFullName(coach.usuario)}</h2>
            {coach.presentacion && <blockquote>“{coach.presentacion}”</blockquote>}
            {coach.biografia && <p>{coach.biografia}</p>}
            {coach.experiencia_anios != null && <small>{coach.experiencia_anios} años de experiencia</small>}
          </div>
        </div>
        <div className="founder-page__moments">
          {images.slice(1).map((image, index) => {
            const activity = coach.actividades?.[index];
            return <article className={index % 2 ? 'founder-page__moment founder-page__moment--reverse' : 'founder-page__moment'} key={image.id}>
              <ResilientImage src={image.src} alt={image.texto_alt || getFullName(coach.usuario)} />
              <div><span>{String(index + 1).padStart(2, '0')}</span>{activity?.nombre && <h3>{activity.nombre}</h3>}{image.texto_alt && <p>{image.texto_alt}</p>}</div>
            </article>;
          })}
        </div>
      </>}
    </section>
  );
}
