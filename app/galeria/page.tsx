import type { Metadata } from 'next';
import { PageHero } from '@/components/page-hero';
import { PublicLayout } from '@/components/public-layout';
import { GalleryGrid } from '@/features/gallery/gallery-grid';

export const metadata: Metadata = { title: 'Galería', description: 'Conoce los espacios y la comunidad de Pilates House.' };

export default function GalleryPage() {
  return <PublicLayout tone="dark"><PageHero eyebrow="LA CASA POR DENTRO" title="Galería & eventos" script="Viví la experiencia House" /><GalleryGrid /></PublicLayout>;
}
