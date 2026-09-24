'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuthSession } from '@/hooks/use-auth-session';
import { StatusState } from '@/components/status-state';
import { getFullName } from '@/lib/format';
import type { Coach } from '@/lib/types';
import { editorialImages, type LandingResourceState } from './editorial-gallery';
import { EditorialSkeleton } from './editorial-skeleton';
import { LandingImage } from './landing-image';
import { LandingReveal } from './landing-reveal';

function CommunityHero() {
  return (
    <section id="comunidad" className="community-hero" aria-labelledby="community-hero-title">
      <div className="community-hero__media" aria-hidden="true">
        <Image src="/img/Heata.png" alt="" fill priority sizes="100vw" />
      </div>
      <div className="community-hero__panel">
        <p className="landing-eyebrow">Comunidad Pilates House</p>
        <h1 id="community-hero-title">Pilates House<br />se vive juntas.</h1>
        <p className="community-hero__lead">Una comunidad que se mueve, se inspira y crece dentro y fuera del estudio.</p>
      </div>
    </section>
  );
}

function FounderSection({ coaches, state }: { coaches: Coach[]; state: LandingResourceState }) {
  const coach = coaches.find((item) => /vaness?a/.test(getFullName(item.usuario).toLocaleLowerCase('es'))) || coaches[0];
  const images = editorialImages(coach?.imagenes);
  const mainImage = images[0];
  const fullName = coach ? getFullName(coach.usuario) : 'Vanessa Salas Saenz';
  const firstName = fullName.split(' ')[0];
  return (
    <section id="comunidad-vision" className="community-founder" aria-labelledby="community-founder-title">
      {state.loading && <EditorialSkeleton variant="coach" />}
      {state.error && <StatusState kind="error" title="No pudimos cargar el perfil" description={state.error} actionLabel="Reintentar" onAction={state.retry} />}
      {!state.loading && !state.error && (
        <LandingReveal className="community-founder__inner">
          <figure className="community-founder__photo">
            {mainImage ? (
              <LandingImage src={mainImage.src} alt={mainImage.texto_alt || fullName} loading="lazy" decoding="async" />
            ) : (
              <div className="community-founder__placeholder" role="img" aria-label={`Retrato de ${fullName} pendiente`}><span>{fullName.charAt(0)}</span></div>
            )}
            <figcaption>Fotografía real de {firstName}</figcaption>
          </figure>
          <div className="community-founder__copy">
            <p className="landing-eyebrow">La visión detrás de Pilates House</p>
            <h2 id="community-founder-title">{fullName}</h2>
            <p className="community-founder__role">Fundadora &amp; Head Coach</p>
            <p className="community-founder__bio">{coach?.biografia || coach?.presentacion || 'Una visión de movimiento consciente, bienestar y comunidad convertida en una experiencia diseñada hasta el último detalle.'}</p>
          </div>
        </LandingReveal>
      )}
    </section>
  );
}

type AgendaItem = {
  id: string;
  label: string;
  heading: string;
  image: string;
  alt: string;
  title: string;
  meta: string;
  badge?: string;
  linkLabel: string;
  href: string;
};

const AGENDA_ITEMS: AgendaItem[] = [
  {
    id: 'pasado',
    label: 'Pasado',
    heading: 'Lo que vivimos',
    image: '/img/Community.png',
    alt: 'Recuerdos de la comunidad Pilates House',
    title: 'Revival Sunday',
    meta: 'Agosto 2026',
    linkLabel: 'Ver galería',
    href: '/galeria',
  },
  {
    id: 'ahora',
    label: 'Ahora',
    heading: 'Nuestros eventos',
    image: '/img/Communitya.png',
    alt: 'Encuentros de la comunidad Pilates House',
    title: 'Eventos exclusivos',
    meta: 'Consulta las fechas y tu acceso por membresía',
    linkLabel: 'Ver eventos',
    href: '/mi-panel/Eventos',
  },
  {
    id: 'proximo',
    label: 'Próximo',
    heading: 'Lo que viene',
    image: '/img/Recovery.png',
    alt: 'Próxima experiencia de Pilates House',
    title: 'Tu próximo encuentro en House',
    meta: 'Consulta los eventos publicados y sus cupos',
    linkLabel: 'Reservar mi lugar',
    href: '/mi-panel/Eventos',
  },
];

function AgendaSection() {
  const session = useAuthSession();
  const eventsHref = session?.user.roles.includes('CLIENTE') ? '/mi-panel/Eventos' : '/login?next=%2Fmi-panel%2FEventos';
  return (
    <section id="agenda-comunidad" className="community-agenda" aria-labelledby="community-agenda-title">
      <LandingReveal className="community-agenda__heading">
        <h2 id="community-agenda-title">La agenda de Pilates House.</h2>
        <p>Experiencias para encontrarnos, celebrar y seguir construyendo comunidad.</p>
      </LandingReveal>
      <div className="community-agenda__grid">
        {AGENDA_ITEMS.map((item) => (
          <LandingReveal className="community-agenda__card" key={item.id}>
            <span className="community-agenda__eyebrow">{item.label}</span>
            <h3>{item.heading}</h3>
            <figure className="community-agenda__media">
              <Image src={item.image} alt={item.alt} fill sizes="(max-width: 900px) 100vw, 33vw" />
              {item.badge && <span className="community-agenda__badge">{item.badge}</span>}
            </figure>
            <p className="community-agenda__meta">{item.title} · {item.meta}</p>
            <Link className="landing-text-link" href={item.href === '/mi-panel/Eventos' ? eventsHref : item.href}>{item.linkLabel} <span className="landing-arrow" aria-hidden="true">↗</span></Link>
          </LandingReveal>
        ))}
      </div>
    </section>
  );
}

export function CommunitySection({ coaches, coachState }: { coaches: Coach[]; coachState: LandingResourceState }) {
  return (
    <>
      <CommunityHero />
      <FounderSection coaches={coaches} state={coachState} />
      <AgendaSection />
    </>
  );
}
