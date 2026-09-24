'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const TAGLINE = 'THE HOUSE OF HOT PILATES';

export function LoginStory() {
  const [ready, setReady] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ready) return;
    const text = textRef.current;
    if (!text) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      text.textContent = TAGLINE;
      return;
    }
    let length = 0;
    let timer = 0;
    text.textContent = '';
    function typeNext() {
      if (!text) return;
      text.textContent = TAGLINE.slice(0, ++length);
      if (length < TAGLINE.length) timer = window.setTimeout(typeNext, 55);
    }
    timer = window.setTimeout(typeNext, 700);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return (
    <section className="login-story" aria-label="Pilates House">
      <Image className="login-story__background" src="/img/Fondo.png" alt="" fill priority sizes="(max-width: 980px) 100vw, 65vw" />
      <div className="login-story__content" data-ready={ready}>
        <div className="login-story__logo"><Image src="/img/logo-white-not-sub-letter.png" alt="Pilates House" width={6000} height={793} priority onLoad={() => setReady(true)} /></div>
        <span className="landing-hero__logo-shine" aria-hidden="true" />
        <p className="landing-hero__tagline" aria-label={TAGLINE}>
          <span className="landing-hero__tagline-space" aria-hidden="true">{TAGLINE}</span>
          <span className="landing-hero__tagline-text" aria-hidden="true" ref={textRef} />
        </p>
      </div>
    </section>
  );
}
