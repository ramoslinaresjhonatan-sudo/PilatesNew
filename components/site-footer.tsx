'use client';

import Link from 'next/link';
import { Brand } from './brand';
import { LandingSectionLink } from './landing-section-link';
import { SocialIcon } from './social-icon';
import { useApiResource } from '@/hooks/use-api-resource';
import type { LandingSection } from '@/lib/types';
import { WebsiteSocialEditor } from '../features/panel/website-social-editor';

const defaultSocialItems = [
  { id: 'instagram' as const, label: 'Instagram', href: 'https://www.instagram.com/pilateshouse.hotpilates/', active: true },
  { id: 'facebook' as const, label: 'Facebook', href: null, active: false },
  { id: 'tiktok' as const, label: 'TikTok', href: null, active: false },
  { id: 'whatsapp' as const, label: 'WhatsApp', href: null, active: false },
];

export function SiteFooter({ editorial = false, preview = false }: { editorial?: boolean; preview?: boolean }) {
  const content = useApiResource<LandingSection[]>('/landing/seccion/publicadas');
  const socialSection = content.data?.find((section) => section.clave === 'FOOTER_REDES');
  let savedSocials: Array<{ id: string; href?: string | null }> = [];
  try { savedSocials = JSON.parse(socialSection?.descripcion || '[]'); } catch { savedSocials = []; }
  const socialItems = defaultSocialItems.map((item) => {
    const saved = savedSocials.find((value) => value.id === item.id);
    const href = saved ? saved.href?.trim() || null : item.href;
    return { ...item, href, active: Boolean(href) };
  });
  return (
    <footer className={`landing-footer${editorial ? ' landing-footer--editorial' : ''}`} id="contacto">
      <div className="landing-footer__main">
        <div className="landing-footer__identity">
          <Brand light={!editorial} />
          <p>Movimiento consciente, fuerza y comunidad.</p>
          <div className="landing-footer__socials" aria-label="Redes sociales">
            {socialItems.map((social) => social.href && social.active !== false ? (
              <a className="landing-footer__social-link" href={social.href} key={social.id} target="_blank" rel="noreferrer noopener" aria-label={`Visitar ${social.label}`} title={`Seguir a Pilates House en ${social.label}`}>
                <SocialIcon name={social.id} />
                <span>{social.label}</span>
              </a>
            ) : (
              <span className="landing-footer__social-link landing-footer__social-link--inactive" key={social.id} aria-label={`${social.label} no disponible`} title={`${social.label} no disponible`}>
                <SocialIcon name={social.id} />
                <span>{social.label}</span>
              </span>
            ))}
          </div>
        </div>

        <nav className="landing-footer__column" aria-label="Enlaces del pie de página">
          <h2>Explora</h2>
          <LandingSectionLink section="experiencia">Disciplines</LandingSectionLink>
          <LandingSectionLink section="metodos">The Experience</LandingSectionLink>
          <LandingSectionLink section="beyond">Beyond</LandingSectionLink>
          <LandingSectionLink section="membresias">Membresías</LandingSectionLink>
          <LandingSectionLink section="comunidad">Comunidad</LandingSectionLink>
          <Link href="/galeria">Galería y eventos</Link>
        </nav>

        <div className="landing-footer__column">
          <h2>Contacto</h2>
          <p>Santa Cruz de la Sierra, Bolivia</p>
          <Link href="/login">Mi perfil</Link>
        </div>
      </div>

      <div className="landing-footer__bottom">
        <p>© {new Date().getFullYear()} Pilates House. Todos los derechos reservados.</p>
      </div>
      {preview && <WebsiteSocialEditor />}
    </footer>
  );
}
