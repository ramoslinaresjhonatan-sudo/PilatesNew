/* eslint-disable @next/next/no-img-element -- La imagen se sirve desde el endpoint por ID del backend. */
'use client';

import type { ImgHTMLAttributes, SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

type FailureState = {
  attempt: number;
  failed: boolean;
  source: string;
  waiting: boolean;
};

type ResilientImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  maxRetries?: number;
  retryDelayMs?: number;
};

function retryUrl(source: string, attempt: number) {
  if (attempt === 0) return source;
  try {
    const url = new URL(source, window.location.origin);
    url.searchParams.set('__image_retry', String(attempt));
    return url.toString();
  } catch {
    return source;
  }
}

export function ResilientImage({ src, alt = '', className, maxRetries = 2, retryDelayMs = 500, onError, ...props }: ResilientImageProps) {
  const [failure, setFailure] = useState<FailureState>({ attempt: 0, failed: false, source: src, waiting: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = failure.source === src ? failure : { attempt: 0, failed: false, source: src, waiting: false };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    if (current.attempt >= maxRetries) {
      setFailure({ ...current, failed: true, waiting: false });
      onError?.(event);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setFailure({ ...current, waiting: true });
    timer.current = setTimeout(() => {
      setFailure({ attempt: current.attempt + 1, failed: false, source: src, waiting: false });
    }, retryDelayMs * 2 ** current.attempt);
  }

  if (current.waiting || current.failed) {
    const label = current.failed ? `Imagen no disponible${alt ? `: ${alt}` : ''}` : `Reintentando imagen${alt ? `: ${alt}` : ''}`;
    return <span className={`resilient-image-placeholder${className ? ` ${className}` : ''}`} role="img" aria-label={label}><small aria-hidden="true">{current.failed ? 'Imagen temporalmente no disponible' : 'Cargando imagen…'}</small></span>;
  }

  return <img {...props} className={className} src={retryUrl(src, current.attempt)} alt={alt} onError={handleError} />;
}
