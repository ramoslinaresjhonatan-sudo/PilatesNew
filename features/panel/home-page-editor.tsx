import { HeroSection } from '@/features/landing/hero-section';
import { HouseRitual } from '@/features/landing/house-ritual';
import { SiteFooter } from '@/components/site-footer';

export function HomePageEditor() {
  return <main className="gallery-web-preview">
    <div className="gallery-web-preview__landing"><HeroSection preview /><HouseRitual preview /><SiteFooter preview /></div>
  </main>;
}
