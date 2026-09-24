'use client';

import Link from 'next/link';
import { CommunitySection } from './community-section';
import { LandingSkeleton } from './landing-skeleton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/app-icon';
import { ContentCarousel } from '@/components/content-carousel';
import { ResilientImage } from '@/components/resilient-image';
import { StatusState } from '@/components/status-state';
import { useApiResource } from '@/hooks/use-api-resource';
import { STUDIO_TIME_ZONE, studioAddDays, studioDateKey, studioDateTimeIso } from '@/lib/studio-time';
import { safeAssetUrl } from '@/lib/api';
import { getCategoryLabel } from '@/lib/catalog';
import { getMembershipBenefitPoints, getMembershipCoverage } from '@/lib/format';
import { isMembershipPlansStorageEvent, MEMBERSHIP_PLANS_UPDATED_EVENT } from '@/lib/membership-plan-events';
import type { Activity, ActivityCategory, ActivityCategoryRecord, Coach, KnownActivityCategory, LandingSection, MembershipPlan, ScheduleItem } from '@/lib/types';

const CATEGORY_COPY: Partial<Record<KnownActivityCategory, { title: string; order: number }>> = {
  CLASE: { title:'Clases', order:10 },
  SESION: { title:'Sesiones', order:20 },
  EXPERIENCIA: { title:'Experiencias', order:30 },
};

const priceFormatter = new Intl.NumberFormat('es-BO', { maximumFractionDigits:0 });

type ResourceState = { loading: boolean; error: string | null; retry: () => void };

function firstImage(images: Activity['imagenes'] | MembershipPlan['imagenes'] | Coach['imagenes'] | LandingSection['imagenes']) {
  return safeAssetUrl(images?.[0]?.url, '', images?.[0]?.id);
}

function formatPlanPrice(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${priceFormatter.format(amount)} Bs` : '—';
}

function normalizeCategory(value: ActivityCategory) {
  return String(value).trim().toUpperCase() as ActivityCategory;
}

function categoryDomId(value: ActivityCategory) {
  return `category-${normalizeCategory(value).toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '-')}`;
}

function getCategoryCopy(category: ActivityCategory, metadata?: ActivityCategoryRecord) {
  const normalized = normalizeCategory(category);
  const known = CATEGORY_COPY[normalized as KnownActivityCategory];
  const label = metadata?.nombre || getCategoryLabel(normalized);
  return {
    title: metadata?.nombre || known?.title || label,
    order: metadata?.orden ?? known?.order ?? Number.MAX_SAFE_INTEGER,
  };
}

function ExperienceCard({ activity }: { activity: Activity }) {
  const isSession = normalizeCategory(activity.categoria) === 'SESION';
  const image = firstImage(activity.imagenes);
  return (
    <article className={isSession ? 'experience-card experience-card--session' : 'experience-card'}>
      <div className={`experience-card__media${isSession && !image ? ' experience-card__media--icon' : ''}${!isSession && !image ? ' experience-card__media--empty' : ''}`}>
        {image ? <ResilientImage src={image} alt={activity.imagenes?.[0]?.texto_alt || activity.nombre} loading="lazy" decoding="async" /> : isSession ? <AppIcon name="membership" /> : null}
        <span>{getCategoryLabel(activity.categoria)}</span>
      </div>
      <div className="experience-card__body">
        {activity.subtitulo && <span className="experience-card__subtitle">{activity.subtitulo}</span>}
        <h3>{activity.nombre}</h3>
        {activity.descripcion_corta && <p>{activity.descripcion_corta}</p>}
      </div>
    </article>
  );
}

function ExperienceSection({ activities, categories, state }: { activities: Activity[]; categories: ActivityCategoryRecord[]; state: ResourceState }) {
  const groups = useMemo(() => {
    const metadataByCode = new Map(categories.map((category) => [normalizeCategory(category.codigo), category]));
    const groupedActivities = new Map<ActivityCategory, Activity[]>();

    activities.forEach((activity) => {
      const category = normalizeCategory(activity.categoria);
      const group = groupedActivities.get(category) || [];
      group.push(activity);
      groupedActivities.set(category, group);
    });

    const categoryCodes = new Set<ActivityCategory>([
      ...metadataByCode.keys(),
      ...groupedActivities.keys(),
    ]);

    return [...categoryCodes]
      .map((category, index) => {
        const metadata = metadataByCode.get(category);
        return {
          category,
          activities: (groupedActivities.get(category) || []).sort((first, second) => (first.orden ?? 0) - (second.orden ?? 0) || first.nombre.localeCompare(second.nombre, 'es')),
          copy: getCategoryCopy(category, metadata),
          index,
        };
      })
      .filter((group) => group.activities.length > 0 || metadataByCode.get(group.category)?.visible_landing !== false)
      .sort((first, second) => first.copy.order - second.copy.order || first.index - second.index);
  }, [activities, categories]);

  return (
    <section id="metodos" className="experience-section">
      <header className="landing-section-heading experience-section__heading"><h2>Experiencia</h2></header>
      {state.loading && <LandingSkeleton kind="experiences" label="Cargando experiencias" />}
      {state.error && <StatusState kind="error" title="No pudimos cargar las experiencias" description={state.error} actionLabel="Reintentar" onAction={state.retry} />}
      {!state.loading && !state.error && activities.length === 0 && <StatusState title="Sin experiencias publicadas" description="Todavía no hay disciplinas publicadas para mostrar." />}
      {!state.loading && !state.error && groups.map(({ category, copy, activities: categoryActivities }) => {
        const headingId = categoryDomId(category);
        return (
          <section className="experience-catalog-group" key={category} aria-labelledby={headingId}>
            <header className="experience-catalog-group__heading"><h3 id={headingId}>{copy.title}</h3></header>
            <p className="experience-catalog-group__label">Modalidades</p>
            {categoryActivities.length > 0 ? (
              <ContentCarousel ariaLabel={`Disciplinas de ${getCategoryLabel(category)}`} className="content-carousel--experiences" itemCount={categoryActivities.length} autoAdvanceMs={5_000}>
                {categoryActivities.map((activity) => <ExperienceCard activity={activity} key={activity.id} />)}
              </ContentCarousel>
            ) : (
              <StatusState title={`Sin disciplinas en ${getCategoryLabel(category)}`} description="Esta categoría todavía no tiene actividades visibles." />
            )}
          </section>
        );
      })}
    </section>
  );
}

function findRelevantClass(items: ScheduleItem[], now: Date) {
  const unavailableStates = new Set(['BORRADOR', 'CANCELADA', 'CANCELADO', 'SUSPENDIDA', 'SUSPENDIDO']);
  const candidates = items
    .filter((item) => normalizeCategory(item.categoria) === 'CLASE')
    .filter((item) => !unavailableStates.has(String(item.estado).toUpperCase()) && !unavailableStates.has(String(item.estado_clase).toUpperCase()))
    .map((item) => ({ ...item, start:new Date(item.fecha_inicio), end:new Date(item.fecha_fin) }))
    .filter((item) => !Number.isNaN(item.start.getTime()) && !Number.isNaN(item.end.getTime()))
    .sort((first, second) => first.start.getTime() - second.start.getTime());
  const current = candidates.find((item) => item.start <= now && item.end > now);
  if (current) return { ...current, timing:'EN CURSO' };
  const next = candidates.find((item) => item.start > now);
  return next ? { ...next, timing:'SIGUIENTE CLASE' } : null;
}

function SchedulePreview({ items, state }: { items: ScheduleItem[]; state: ResourceState }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const relevantClass = useMemo(() => findRelevantClass(items, now), [items, now]);
  const date = relevantClass?.start;
  const weekday = date ? new Intl.DateTimeFormat('es-BO', { weekday:'long', timeZone:STUDIO_TIME_ZONE }).format(date) : '';
  const dayMonth = date ? new Intl.DateTimeFormat('es-BO', { day:'numeric', month:'long', timeZone:STUDIO_TIME_ZONE }).format(date) : '';
  const time = date ? new Intl.DateTimeFormat('es-BO', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:STUDIO_TIME_ZONE }).format(date) : '';
  const endTime = relevantClass ? new Intl.DateTimeFormat('es-BO', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:STUDIO_TIME_ZONE }).format(relevantClass.end) : '';
  const image = relevantClass ? firstImage(relevantClass.imagenes) : '';
  return (
    <section id="horarios" className="schedule-spotlight-section"><div className="schedule-spotlight-section__inner">
      <header className="schedule-spotlight-section__heading"><h2>Encontrá tu momento</h2></header>
      {state.loading && <LandingSkeleton kind="schedule" label="Cargando horarios" />}
      {state.error && <StatusState kind="error" title="No pudimos cargar la agenda" description={state.error} actionLabel="Reintentar" onAction={state.retry} />}
      {!state.loading && !state.error && relevantClass && <article className="schedule-spotlight-card">
        <div className={`schedule-spotlight-card__image${image ? '' : ' schedule-spotlight-card__image--empty'}`}>{image && <ResilientImage src={image} alt={relevantClass.imagenes?.[0]?.texto_alt || relevantClass.actividad} loading="lazy" decoding="async" />}<span>{relevantClass.timing}</span></div>
        <div className="schedule-spotlight-card__details"><div className="schedule-spotlight-card__date"><div><span>DÍA</span><strong>{weekday}</strong></div><div><span>FECHA</span><strong>{dayMonth}</strong></div></div><div className="schedule-spotlight-card__class"><span>{time} — {endTime}</span><h3>{relevantClass.actividad}</h3><p>{relevantClass.cupos_disponibles} de {relevantClass.cupos} cupos disponibles</p></div><Link className="schedule-spotlight-section__action" href="/login">VER HORARIOS Y RESERVAR</Link></div>
      </article>}
      {!state.loading && !state.error && !relevantClass && <div className="schedule-spotlight-card schedule-spotlight-card--empty"><div className="schedule-spotlight-card__image schedule-spotlight-card__image--empty" /><div className="schedule-spotlight-card__details"><span className="schedule-spotlight-card__empty-label">AGENDA</span><h3>No hay próximos horarios publicados.</h3><p>Consultá la agenda o volvé a intentar cuando se publique un nuevo cronograma.</p><Link className="schedule-spotlight-section__action" href="/login">VER AGENDA COMPLETA</Link></div></div>}
    </div></section>
  );
}

function MembershipSection({ plans, state }: { plans: MembershipPlan[]; state: ResourceState }) {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const orderedPlans = useMemo(() => [...plans].sort((first, second) => (first.orden ?? 0) - (second.orden ?? 0) || first.nombre.localeCompare(second.nombre, 'es')), [plans]);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    // Measure natural content across every slide, including offscreen plans.
    const selectors = {
      summary: '.reference-membership-card__summary-inner',
      description: '.reference-membership-card__details-inner',
      action: '.reference-membership-card__button',
    };
    const measure = () => {
      Object.entries(selectors).forEach(([name, selector]) => {
        const heights = Array.from(section.querySelectorAll<HTMLElement>(selector), (element) => element.getBoundingClientRect().height);
        section.style.setProperty(`--membership-${name}-height`, `${Math.ceil(Math.max(0, ...heights))}px`);
      });
    };
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    Object.values(selectors).forEach((selector) => section.querySelectorAll(selector).forEach((element) => observer.observe(element)));
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [orderedPlans]);
  return (
    <section id="membresias" className="reference-membership-section" ref={sectionRef}>
      <header className="landing-section-heading reference-membership-section__header"><h2>Membresías</h2></header>
      {state.loading && <LandingSkeleton kind="memberships" label="Cargando membresias" />}
      {state.error && <StatusState kind="error" title="No pudimos cargar las membresías" description={state.error} actionLabel="Reintentar" onAction={state.retry} />}
      {!state.loading && !state.error && plans.length === 0 && <StatusState title="Sin membresías publicadas" description="Todavía no hay membresías publicadas para mostrar." />}
      {!state.loading && !state.error && orderedPlans.length > 0 && <ContentCarousel ariaLabel="Membresías disponibles" className="content-carousel--memberships" itemCount={orderedPlans.length} autoAdvanceMs={7_000}>{orderedPlans.map((plan) => {
        const destination = `/afiliacion/${encodeURIComponent(plan.slug)}`;
        const href = destination;
        const image = firstImage(plan.imagenes);
        const expanded = expandedPlanId === plan.id;
        const toggle = () => setExpandedPlanId((current) => current === plan.id ? null : plan.id);
        const detailsId = `membership-details-${plan.id}`;
        return <article className={`reference-membership-card${plan.destacado ? ' reference-membership-card--featured' : ''}${expanded ? ' reference-membership-card--expanded' : ''}`} key={plan.id}>
          <button type="button" className="reference-membership-card__media" onClick={toggle} tabIndex={-1} aria-label={`Ver detalles de ${plan.nombre}`} aria-expanded={expanded} aria-controls={detailsId}>
            {image && <ResilientImage src={image} alt={plan.imagenes?.[0]?.texto_alt || plan.nombre} loading="lazy" decoding="async" />}
          </button>
          {plan.destacado && <span className="reference-membership-card__badge">MÁS ELEGIDO</span>}
          <div className="reference-membership-card__panel" onClick={(event) => { if (!(event.target as HTMLElement).closest('a, button')) toggle(); }}>
            <div className="reference-membership-card__summary"><div className="reference-membership-card__summary-inner">
            <h3><button type="button" className="reference-membership-card__toggle" onClick={toggle} aria-expanded={expanded} aria-controls={detailsId}>{plan.nombre}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button></h3>
            <p className="reference-membership-card__price"><strong>{formatPlanPrice(plan.precio)}</strong><span>/ {plan.duracion_dias} DÍAS</span></p>
            <ul>{getMembershipCoverage(plan).map((item) => <li key={item}>{item}</li>)}</ul>
            </div></div>
            <div className="reference-membership-card__details" id={detailsId} inert={!expanded} aria-hidden={!expanded}>
              <div className="reference-membership-card__details-inner">
                <ul className="reference-membership-card__description">
                  {getMembershipBenefitPoints(plan).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            <Link className="reference-membership-card__button" href={href}>REGISTRARME EN {plan.nombre.toUpperCase()}</Link>
          </div>
        </article>;
      })}</ContentCarousel>}
    </section>
  );
}

export type PublicContentSection = 'methods' | 'schedule' | 'memberships' | 'comunidad';

export function LandingContent({ section }: { section: PublicContentSection }) {
  const activityResource = useApiResource<Activity[]>(section === 'methods' ? '/actividad?visible_landing=true' : null);
  const configuredCategoryPath = process.env.NEXT_PUBLIC_ACTIVITY_CATEGORIES_PATH?.trim();
  const categoryPath = configuredCategoryPath?.startsWith('/') && !configuredCategoryPath.startsWith('//') ? configuredCategoryPath : null;
  const categoryResource = useApiResource<ActivityCategoryRecord[]>(section === 'methods' ? categoryPath : null);
  const planResource = useApiResource<MembershipPlan[]>(section === 'memberships' ? '/plan-membresia?visible_landing=true' : null);
  const retryPlans = planResource.retry;
  useEffect(() => {
    const refreshPlans = () => retryPlans();
    const refreshFromAnotherTab = (event: StorageEvent) => { if (isMembershipPlansStorageEvent(event)) refreshPlans(); };
    window.addEventListener(MEMBERSHIP_PLANS_UPDATED_EVENT, refreshPlans);
    window.addEventListener('storage', refreshFromAnotherTab);
    return () => {
      window.removeEventListener(MEMBERSHIP_PLANS_UPDATED_EVENT, refreshPlans);
      window.removeEventListener('storage', refreshFromAnotherTab);
    };
  }, [retryPlans]);
  const schedulePath = useMemo(() => {
    const desde = studioDateKey(new Date());
    const hasta = studioAddDays(desde, 13);
    const query = new URLSearchParams({
      categoria: 'CLASE',
      desde: studioDateTimeIso(desde, '00:00'),
      hasta: studioDateTimeIso(hasta, '00:00', true),
    });
    return `/agenda?${query}`;
  }, []);
  const scheduleResource = useApiResource<ScheduleItem[]>(section === 'schedule' ? schedulePath : null);
  const coachResource = useApiResource<Coach[]>(section === 'comunidad' ? '/coach?visible_landing=true' : null);
  return <>{section === 'methods' && <ExperienceSection activities={activityResource.data || []} categories={categoryResource.data || []} state={{ loading: activityResource.loading || categoryResource.loading, error: activityResource.error || categoryResource.error, retry: () => { activityResource.retry(); categoryResource.retry(); } }} />}{section === 'schedule' && <SchedulePreview items={scheduleResource.data || []} state={scheduleResource} />}{section === 'memberships' && <MembershipSection plans={planResource.data || []} state={planResource} />}{section === 'comunidad' && <CommunitySection coaches={coachResource.data || []} coachState={coachResource} />}</>;
}
