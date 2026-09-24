import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ScheduleRitual } from '@/features/landing/schedule-ritual';

export const metadata: Metadata = { title: 'Schedule' };

export default function Page() {
  return <><SiteHeader variant="solid" /><main className="landing-page public-content-page"><ScheduleRitual /></main><SiteFooter /></>;
}
