import type { Metadata } from 'next';
import { PanelShell } from '@/components/panel-shell';

export const metadata: Metadata = { title: { default: 'Mi espacio', template: '%s | Pilates House' }, robots: { index: false, follow: false } };

export default function ClientPanelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell clientArea>{children}</PanelShell>;
}
