'use client';

import { ScrollDiscovery } from './scroll-discovery';
import { LandingTextEditor } from '../panel/landing-text-editor';
import { useApiResource } from '@/hooks/use-api-resource';
import type { LandingSection } from '@/lib/types';

export function HouseRitual({ preview = false }: { preview?: boolean }) {
  const content = useApiResource<LandingSection[]>('/landing/seccion/publicadas');
  const heading = content.data?.find((section) => section.clave === 'RITUAL_TITULO');
  return (
    <section id="ritual" className="house-ritual" aria-labelledby="house-ritual-title">
      <h2 id="house-ritual-title">{heading?.titulo || 'More than Pilates.'}<br /><span>{heading?.subtitulo || 'A ritual created around you.'}</span></h2>
      {preview && <LandingTextEditor sectionKey="RITUAL_TITULO" storageTitle="Ritual titulo" heading="Título del ritual" defaults={{ titulo: 'More than Pilates.', subtitulo: 'A ritual created around you.', descripcion: '' }} />}
      <ScrollDiscovery preview={preview} />
    </section>
  );
}
