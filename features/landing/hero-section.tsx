'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LandingSectionLink } from '@/components/landing-section-link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HeroImageEditor } from '../panel/hero-image-editor';
import { useApiResource } from '@/hooks/use-api-resource';
import { safeAssetUrl } from '@/lib/http-client';
import type { LandingSection } from '@/lib/types';

const SCROLL_HIDE_THRESHOLD = 48;
const SCROLL_SHOW_THRESHOLD = 12;
const HERO_LINES = ['THE HOUSE OF HOT PILATES'] as const;

export function HeroSection({ preview = false }: { preview?: boolean }) {
  const heroContent = useApiResource<LandingSection[]>('/landing/seccion/publicadas');
  const heroImage = heroContent.data?.find((section) => section.clave === 'HERO_IMAGEN')?.imagenes?.[0];
  const heroText = heroContent.data?.find((section) => section.clave === 'HERO_TEXTO');
  const heroLines = useMemo(() => [heroText?.titulo || HERO_LINES[0]], [heroText?.titulo]);
  const actionLabels = (heroText?.descripcion || 'VIVÍ LA EXPERIENCIA | RESERVAR').split('|').map((label) => label.trim());
  const heroSource = safeAssetUrl(heroImage?.url, '', heroImage?.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const configuredVideo = process.env.NEXT_PUBLIC_HERO_VIDEO_PATH || '';
  const videoSource = /^\/videos\/[a-zA-Z0-9/_-]+\.(mp4|webm)$/.test(configuredVideo) ? configuredVideo : undefined;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePlayback = () => {
      if (videoPaused || reducedMotion.matches || document.hidden) video.pause();
      else void video.play().catch(() => setVideoReady(false));
    };
    updatePlayback();
    reducedMotion.addEventListener('change', updatePlayback);
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      video.pause();
      reducedMotion.removeEventListener('change', updatePlayback);
      document.removeEventListener('visibilitychange', updatePlayback);
    };
  }, [videoSource, videoPaused]);
  const floatingLogoRef = useRef<HTMLDivElement>(null);

  const textRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useLayoutEffect(() => {
    let typingTimer = 0;
    let typingVisible = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function syncTyping(visible: boolean) {
      if (visible === typingVisible) return;
      typingVisible = visible;
      window.clearTimeout(typingTimer);
      const texts = textRefs.current;
      texts.forEach((text) => { if (text) text.textContent = ''; });
      if (!visible) return;
      if (reducedMotion.matches) {
        texts.forEach((text, index) => { if (text) text.textContent = heroLines[index]; });
        return;
      }
      let line = 0;
      let length = 0;
      function typeNext() {
        if (!typingVisible) return;
        const text = texts[line];
        if (text) text.textContent = heroLines[line].slice(0, ++length);
        if (length < heroLines[line].length) {
          typingTimer = window.setTimeout(typeNext, 30);
        } else if (line < HERO_LINES.length - 1) {
          line += 1;
          length = 0;
          typingTimer = window.setTimeout(typeNext, 120);
        }
      }
      typingTimer = window.setTimeout(typeNext, 167);
    }

    let animationFrame = 0;
    let revealFrame = 0;
    let revealStartFrame = 0;
    let isScrolled = window.scrollY > SCROLL_HIDE_THRESHOLD;

    function updateLogoState() {
      animationFrame = 0;
      const logo = floatingLogoRef.current;
      if (!logo) return;

      // Separate thresholds prevent flickering around the scroll boundary.
      isScrolled = isScrolled
        ? window.scrollY > SCROLL_SHOW_THRESHOLD
        : window.scrollY > SCROLL_HIDE_THRESHOLD;
      logo.dataset.hidden = isScrolled ? 'true' : 'false';
      logo.inert = isScrolled || logo.dataset.ready !== 'true';
      syncTyping(!isScrolled && logo.dataset.ready === 'true');
      const root = document.documentElement.style;
      root.setProperty('--hero-brand-opacity', isScrolled ? '1' : '0');
      root.setProperty('--hero-brand-y', isScrolled ? '0rem' : '-0.45rem');
      root.setProperty('--hero-brand-scale', isScrolled ? '1' : '0.94');
      root.setProperty('--hero-brand-blur', isScrolled ? '0px' : '5px');
      root.setProperty('--hero-brand-pointer-events', isScrolled ? 'auto' : 'none');
    }

    function scheduleLogoState() {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateLogoState);
    }

    updateLogoState();
    const logo = floatingLogoRef.current;
    function revealLogo() {
      window.cancelAnimationFrame(revealStartFrame);
      window.cancelAnimationFrame(revealFrame);
      revealStartFrame = window.requestAnimationFrame(() => {
        revealFrame = window.requestAnimationFrame(() => {
          if (logo) logo.dataset.ready = 'true';
          updateLogoState();
        });
      });
    }
    revealLogo();
    window.addEventListener('scroll', scheduleLogoState, { passive: true });
    window.addEventListener('resize', scheduleLogoState);

    return () => {
      window.clearTimeout(typingTimer);
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(revealStartFrame);
      window.cancelAnimationFrame(revealFrame);
      window.removeEventListener('scroll', scheduleLogoState);
      window.removeEventListener('resize', scheduleLogoState);
      const root = document.documentElement.style;
      ['--hero-brand-opacity', '--hero-brand-y', '--hero-brand-scale', '--hero-brand-blur', '--hero-brand-pointer-events']
        .forEach((property) => root.removeProperty(property));
    };
  }, [heroLines]);

  return (
    <div className="landing-hero-layout">
      <div
        ref={floatingLogoRef}
        className="landing-hero__floating-logo landing-hero__intro"
        data-hidden="false"
        data-ready="false"
      >
        <div className="landing-hero__brand-lockup">
        <h1 className="landing-hero__brand">
          <Image src="/img/logo-white-not-sub-letter.png" alt="Pilates House" width={6000} height={793} priority />
        </h1>
        <span className="landing-hero__logo-shine" aria-hidden="true" />
        {heroLines.map((line, index) => (
          <p className={index === 0 ? 'landing-hero__subtitle' : 'landing-hero__motto'} aria-label={line} key={line}>
            <span className="landing-hero__tagline-space" aria-hidden="true">{line}</span>
            <span aria-hidden="true" ref={(element) => { textRefs.current[index] = element; }} />
          </p>
        ))}
        </div>
        <p className="landing-hero__motto">{heroText?.subtitulo || 'Move. Sweat. Recover. Belong.'}</p>
        <div className="landing-hero__actions">
          <Link href="/experience" className="landing-hero__button landing-hero__button--primary">{actionLabels[0] || 'VIVÍ LA EXPERIENCIA'}</Link>
          <LandingSectionLink section="horarios" className="landing-hero__button">{actionLabels[1] || 'RESERVAR'}</LandingSectionLink>
        </div>
      </div>

      <section id="inicio" className="landing-hero" aria-label="Pilates House">
        <div className="landing-hero__media" aria-hidden="true">
          {heroSource ? <img className="landing-hero__configured-image" src={heroSource} alt={heroImage?.texto_alt || ''} /> : <Image src="/img/Fondo.png" alt="" fill priority sizes="100vw" />}
          {videoSource && <video ref={videoRef} className="landing-hero__video" data-ready={videoReady} src={videoSource} muted loop playsInline preload="metadata" poster={heroSource || '/img/Fondo.png'} onPlaying={() => setVideoReady(true)} onError={() => setVideoReady(false)} />}
        </div>
        {preview && <HeroImageEditor />}
        <LandingSectionLink section="ritual" className="landing-hero__discover"><span aria-hidden="true">↓</span> Discover the House</LandingSectionLink>
        {videoSource && videoReady && <button className="landing-hero__video-control" type="button" onClick={() => setVideoPaused((paused) => !paused)} aria-label={videoPaused ? 'Reproducir video de portada' : 'Pausar video de portada'}>{videoPaused ? 'Reproducir' : 'Pausar'}</button>}
      </section>
    </div>
  );
}
