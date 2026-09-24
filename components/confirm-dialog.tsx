'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para acciones destructivas: anular, dar de baja, eliminar. */
  tone?: 'danger' | 'default';
};

type PendingConfirm = ConfirmRequest & { resolve: (accepted: boolean) => void };

/**
 * Reemplaza al `confirm()` del navegador por un modal propio.
 * Devuelve una promesa igual que `confirm`, así el llamador no cambia de forma:
 *   if (!(await confirm({ title: '…' }))) return;
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...request, resolve });
      }),
    [],
  );

  const settle = useCallback((accepted: boolean) => {
    setPending((current) => {
      current?.resolve(accepted);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return undefined;
    confirmButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, settle]);

  const dialog =
    pending && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="confirm-layer"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) settle(false);
            }}
          >
            <div
              className={`confirm-dialog${pending.tone === 'danger' ? ' confirm-dialog--danger' : ''}`}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby={pending.description ? 'confirm-dialog-description' : undefined}
            >
              <h2 id="confirm-dialog-title">{pending.title}</h2>
              {pending.description && <p id="confirm-dialog-description">{pending.description}</p>}
              <footer>
                <button className="button button-outline" type="button" onClick={() => settle(false)}>
                  {pending.cancelLabel || 'Cancelar'}
                </button>
                <button
                  ref={confirmButton}
                  className={pending.tone === 'danger' ? 'button button-danger' : 'button button-dark'}
                  type="button"
                  onClick={() => settle(true)}
                >
                  {pending.confirmLabel || 'Confirmar'}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )
      : null;

  return { confirm, confirmDialog: dialog };
}
