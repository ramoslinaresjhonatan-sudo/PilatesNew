'use client';

import { createContext, useContext } from 'react';
import type { ProfileResponse } from '@/lib/types';

export type PanelProfileResource = {
  data: ProfileResponse | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
};

const PanelProfileContext = createContext<PanelProfileResource | null>(null);

export function PanelProfileProvider({ children, value }: { children: React.ReactNode; value: PanelProfileResource }) {
  return <PanelProfileContext.Provider value={value}>{children}</PanelProfileContext.Provider>;
}

export function usePanelProfile() {
  const resource = useContext(PanelProfileContext);
  if (!resource) throw new Error('usePanelProfile debe utilizarse dentro de PanelProfileProvider.');
  return resource;
}
