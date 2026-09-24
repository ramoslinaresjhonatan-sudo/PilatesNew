import type { Metadata } from 'next';
import Image from 'next/image';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { MembershipGrid } from '@/features/landing/membership-grid';
import { MembershipIntro } from './membership-intro';
import './membership-intro.css';

export const metadata: Metadata = { title: 'Memberships' };

export default function Page() {
  return <><SiteHeader variant="solid" /><main className="landing-page public-content-page">
    <MembershipIntro>
      <div className="membership-intro__image">
        <Image src="/img/espacio.png" alt="Espacio de entrenamiento de Pilates House" fill priority sizes="100vw" />
      </div>
      <div className="membership-intro__copy">
        <p className="membership-intro__eyebrow">Disciplina. Bienestar. Comunidad.</p>
        <h1 id="membership-intro-title">Tu lugar<br />en la House.</h1>
        <p className="membership-intro__description">Movimiento, recovery y comunidad.<br />Elegí la experiencia que acompaña tu ritmo.</p>
        <p className="membership-intro__signature">Cuerpos más fuertes<br />Vidas más plenas</p>
      </div>
      <a className="membership-intro__discover" href="#membership-plans">Descubrí las membresías <span aria-hidden="true">↓</span></a>
    </MembershipIntro>
    <div id="membership-plans"><MembershipGrid /></div></main><SiteFooter /></>;
}
