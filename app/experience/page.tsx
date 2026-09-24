import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { RecoveryRitual } from '@/features/landing/recovery-ritual';

export const metadata: Metadata = { title: 'The Experience' };

export default function Page() {
  return <><SiteHeader variant="solid" /><main className="landing-page public-content-page">
    <RecoveryRitual />
  </main><SiteFooter /></>;
}
