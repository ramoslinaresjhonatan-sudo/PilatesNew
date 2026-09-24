import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { HouseRitual } from '@/features/landing/house-ritual';
import { HeroSection } from '@/features/landing/hero-section';
import { LandingPreviewGuard } from '@/components/landing-preview-guard';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ editor_preview?: string }> }) {
  const preview = (await searchParams).editor_preview === '1';
  return (
    <>
      {preview && <LandingPreviewGuard />}
      <SiteHeader floatingBrand />
      <main className="landing-page">
        <HeroSection />
        <HouseRitual />
        <SiteFooter />
      </main>
    </>
  );
}
