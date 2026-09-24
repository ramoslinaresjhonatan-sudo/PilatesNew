import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LandingContent } from '@/features/landing/landing-content';

export const metadata: Metadata = { title: 'Community' };

export default function Page() {
  return <><SiteHeader variant="solid" /><main className="landing-page public-content-page"><LandingContent section="comunidad" /></main><SiteFooter /></>;
}
