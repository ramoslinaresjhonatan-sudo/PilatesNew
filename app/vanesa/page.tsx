import type { Metadata } from 'next';
import { PageHero } from '@/components/page-hero';
import { PublicLayout } from '@/components/public-layout';
import { FounderView } from '@/features/founder/founder-view';

export const metadata: Metadata = { title: 'Nuestra fundadora', description: 'Conoce la historia de Vanessa y la visión detrás de Pilates House.' };

export default function FounderPage() {
  return (
    <PublicLayout>
      <PageHero eyebrow="FUNDADORA & HEAD COACH" title="Vanessa" script="Movimiento con propósito" />
      <FounderView />
    </PublicLayout>
  );
}
