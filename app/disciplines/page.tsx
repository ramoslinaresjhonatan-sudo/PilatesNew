import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ExperienceRitual } from '@/features/landing/experience-ritual';

export const metadata: Metadata = { title: 'Disciplines' };

export default function Page() {
  return <><SiteHeader variant="solid" /><main className="landing-page public-content-page"><ExperienceRitual /></main><SiteFooter /></>;
}
