'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep the shortcut local to this screen and clear every timer on navigation. */
export function useRecentReservation() {
  const [recent, setRecent] = useState<Record<string, boolean>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); pending.clear(); };
  }, []);
  const mark = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    setRecent(current => ({ ...current, [id]: true }));
    timers.current.set(id, setTimeout(() => {
      setRecent(current => { const next = { ...current }; delete next[id]; return next; });
      timers.current.delete(id);
    }, 8000));
  }, []);
  return { recent, mark };
}
