'use client';

import { useState, type ComponentProps } from 'react';
import { ResilientImage } from '@/components/resilient-image';

/** Fade in a fully decoded photo, keeping the existing image retries/fallback. */
export function LandingImage({ src, className = '', onLoad, ...props }: ComponentProps<typeof ResilientImage>) {
  const [readySource, setReadySource] = useState<string | null>(null);
  return <ResilientImage
    {...props}
    src={src}
    className={`landing-photograph ${className}`.trim()}
    data-ready={readySource === src}
    onLoad={(event) => {
      const photo = event.currentTarget;
      void photo.decode().catch(() => {}).then(() => setReadySource(src));
      onLoad?.(event);
    }}
  />;
}
