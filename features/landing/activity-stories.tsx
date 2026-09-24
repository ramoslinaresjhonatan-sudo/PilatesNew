'use client';

import Link from 'next/link';
import { ResilientImage } from '@/components/resilient-image';
import { StatusState } from '@/components/status-state';
import { useApiResource } from '@/hooks/use-api-resource';
import { safeAssetUrl } from '@/lib/http-client';
import type { Activity, KnownActivityCategory } from '@/lib/types';
import './activity-stories.css';

type ActivityStoriesProps = {
  id: string;
  category: KnownActivityCategory;
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
};

export function ActivityStories({ id, category, eyebrow, title, description, emptyTitle }: ActivityStoriesProps) {
  const resource = useApiResource<Activity[]>('/actividad?visible_landing=true');
  const activities = (resource.data || [])
    .filter((activity) => String(activity.categoria).trim().toUpperCase() === category
      && activity.visible_landing !== false
      && (!activity.estado || activity.estado === 'ACTIVO'))
    .sort((first, second) => (first.orden ?? 0) - (second.orden ?? 0) || first.nombre.localeCompare(second.nombre, 'es'));

  return (
    <section id={id} className="activity-stories" aria-labelledby={`${id}-title`}>
      <header className="activity-stories__intro">
        <p className="activity-stories__eyebrow">{eyebrow}</p>
        <h1 id={`${id}-title`}>{title}</h1>
        <p className="activity-stories__intro-copy">{description}</p>
      </header>
      <div className="activity-stories__list" aria-busy={resource.loading}>
        {resource.loading && <StatusState kind="loading" title="Cargando actividades" description="Estamos preparando las actividades publicadas." />}
        {resource.error && <StatusState kind="error" title="No pudimos cargar las actividades" description={resource.error} actionLabel="Reintentar" onAction={resource.retry} />}
        {!resource.loading && !resource.error && activities.length === 0 && <StatusState title={emptyTitle} description="Pronto encontrarás nuevas propuestas en esta sección." />}
        {!resource.loading && !resource.error && activities.map((activity, index) => {
          const image = activity.imagenes?.[0];
          const source = safeAssetUrl(image?.url, '', image?.id);
          const body = activity.descripcion_corta?.trim() || activity.descripcion_larga?.trim();
          const headingId = `${id}-${activity.id}`;
          return (
            <article className="activity-story" key={activity.id} aria-labelledby={headingId}>
              <div className="activity-story__media">
                {source ? <ResilientImage className="activity-story__image" src={source} alt={image?.texto_alt || activity.nombre} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" /> : (
                  <div className="activity-story__placeholder" role="img" aria-label={`Sin imagen publicada para ${activity.nombre}`}><span aria-hidden="true">Imagen próximamente</span></div>
                )}
              </div>
              <div className="activity-story__content">
                <header className="activity-story__heading">
                  <h2 id={headingId}>{activity.nombre}</h2>
                  {activity.subtitulo?.trim() && <p className="activity-story__subtitle">{activity.subtitulo}</p>}
                </header>
                {body && <p className="activity-story__description">{body}</p>}
                {activity.requiere_reserva && <Link className="activity-story__action" href="/schedule" aria-label={`Ver horarios de ${activity.nombre}`}>Ver horarios <span aria-hidden="true">↗</span></Link>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
