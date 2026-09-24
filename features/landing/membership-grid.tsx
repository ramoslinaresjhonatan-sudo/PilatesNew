'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { StatusState } from '@/components/status-state';
import { ResilientImage } from '@/components/resilient-image';
import { safeAssetUrl } from '@/lib/http-client';
import { useApiResource } from '@/hooks/use-api-resource';
import { isMembershipPlansStorageEvent, MEMBERSHIP_PLANS_UPDATED_EVENT } from '@/lib/membership-plan-events';
import { getMembershipBenefitPoints } from '@/lib/format';
import type { MembershipPlan } from '@/lib/types';
import './membership-grid.css';

const priceFormatter = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

function formatPrice(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${priceFormatter.format(amount)} Bs` : '—';
}

/** No se asume "al mes": se describe la vigencia real de cada plan. */
function periodLabel(days: number) {
  if (days >= 28 && days <= 31) return '/ mes';
  if (days === 7) return '/ semana';
  if (days === 1) return '/ día';
  return `/ ${days} días`;
}

function Line({ className = '' }: { className?: string }) {
  return <span className={`landing-skeleton__line ${className}`.trim()} />;
}

function MembershipSkeleton() {
  return (
    <div className="landing-skeleton landing-skeleton--memberships" role="status" aria-busy="true">
      <span className="sr-only">Cargando membresías</span>
      {[0, 1, 2].map((index) => (
        <div className="landing-skeleton__plan" key={index}>
          <Line className="landing-skeleton__line--medium" />
          <span className="landing-skeleton__price" />
          <Line />
          <Line className="landing-skeleton__line--small" />
          <span className="landing-skeleton__button" />
        </div>
      ))}
    </div>
  );
}

function MembershipCard({ plan }: { plan: MembershipPlan }) {
  const slug = plan.slug.trim().toLowerCase();
  /* Se identifica por el plan real, no por un casillero que se pueda desmarcar sin querer. */
  const isFeatured = slug === 'gold';
  const isBlack = slug === 'black';
  const coverage = getMembershipBenefitPoints(plan);
  const image = plan.imagenes?.[0];
  const imageSource = safeAssetUrl(image?.url, '', image?.id);

  return (
    <article className={`membership-grid__card${isFeatured ? ' membership-grid__card--featured' : ''}${isBlack ? ' membership-grid__card--black' : ''}`}>
      {imageSource && <div className="membership-grid__background" aria-hidden="true"><ResilientImage src={imageSource} alt="" loading="lazy" decoding="async" /></div>}
      {isFeatured && <span className="membership-grid__badge">Más elegida</span>}
      <h3>{plan.nombre}</h3>
      <p className="membership-grid__subtitle">{plan.subtitulo}</p>
      <p className="membership-grid__price"><strong>{formatPrice(plan.precio)}</strong><span>{periodLabel(plan.duracion_dias)}</span></p>
      <ul className="membership-grid__coverage">
        {coverage.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <Link className="membership-grid__button" href={`/afiliacion/${encodeURIComponent(plan.slug)}`}>Elegir membresía</Link>
    </article>
  );
}

export function MembershipGrid() {
  const resource = useApiResource<MembershipPlan[]>('/plan-membresia?visible_landing=true');
  const retry = resource.retry;
  useEffect(() => {
    const refresh = () => retry();
    const refreshFromAnotherTab = (event: StorageEvent) => { if (isMembershipPlansStorageEvent(event)) refresh(); };
    window.addEventListener(MEMBERSHIP_PLANS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refreshFromAnotherTab);
    return () => {
      window.removeEventListener(MEMBERSHIP_PLANS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refreshFromAnotherTab);
    };
  }, [retry]);

  const plans = [...(resource.data || [])].sort(
    (first, second) => (first.orden ?? 0) - (second.orden ?? 0) || first.nombre.localeCompare(second.nombre, 'es'),
  );

  return (
    <section className="membership-grid" aria-labelledby="membership-grid-title">
      <header className="membership-grid__heading">
        <h2 id="membership-grid-title">Elegí tu experiencia</h2>
        <p>Mismas clases. Distintos caminos. Siempre la House.</p>
      </header>

      {resource.loading && <MembershipSkeleton />}
      {resource.error && <StatusState kind="error" title="No pudimos cargar las membresías" description={resource.error} actionLabel="Reintentar" onAction={resource.retry} />}
      {!resource.loading && !resource.error && plans.length === 0 && (
        <StatusState title="Sin membresías publicadas" description="Todavía no hay membresías publicadas para mostrar." />
      )}

      {!resource.loading && !resource.error && plans.length > 0 && (
        <div className="membership-grid__cards">
          {plans.map((plan) => <MembershipCard plan={plan} key={plan.id} />)}
        </div>
      )}
    </section>
  );
}
