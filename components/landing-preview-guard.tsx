'use client';
import { useEffect } from 'react';

/** Preview keeps scrolling available but disables navigation with mouse and keyboard. */
export function LandingPreviewGuard() {
  useEffect(() => {
    const block = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('a,button,form')) { event.preventDefault(); event.stopPropagation(); }
    };
    const disable = () => document.querySelectorAll<HTMLElement>('a,button,input,select,textarea').forEach(element => { element.tabIndex = -1; element.setAttribute('aria-disabled', 'true'); });
    disable();
    const observer = new MutationObserver(disable); observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', block, true); document.addEventListener('submit', block, true);
    return () => { observer.disconnect(); document.removeEventListener('click', block, true); document.removeEventListener('submit', block, true); };
  }, []);
  return null;
}
