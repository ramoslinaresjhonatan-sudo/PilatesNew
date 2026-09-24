import type { Metadata } from 'next';
import { PanelShell } from '@/components/panel-shell';

export const metadata: Metadata = { title: { default: 'Mi panel', template: '%s | Pilates House' }, robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
