import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { BeyondRitual } from '@/features/landing/beyond-ritual';

export const metadata: Metadata = { title: 'Beyond the Mat' };

export default function Page() {
  return <><SiteHeader variant="solid" /><main className="landing-page public-content-page">
    <BeyondRitual />
  </main><SiteFooter /></>;
}
