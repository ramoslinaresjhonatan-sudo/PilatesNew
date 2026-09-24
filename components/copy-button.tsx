'use client';

import { useEffect, useRef, useState } from 'react';

/** Copia al portapapeles con respaldo para navegadores sin Clipboard API. */
async function writeToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Sin permiso de portapapeles: se intenta el respaldo.
  }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label = 'Copiar', copiedLabel = 'Copiado' }: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const copied = await writeToClipboard(value);
    setState(copied ? 'copied' : 'error');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      className={`copy-button${state === 'copied' ? ' is-copied' : ''}`}
      type="button"
      onClick={() => void copy()}
      aria-label={`${label}: ${value}`}
    >
      <span aria-hidden="true">{state === 'copied' ? '✓' : '⧉'}</span>
      {state === 'copied' ? copiedLabel : state === 'error' ? 'Copiá a mano' : label}
    </button>
  );
}

/** Fila de credencial con su propio botón de copiado. */
export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="copy-field">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <CopyButton value={value} />
    </div>
  );
}
