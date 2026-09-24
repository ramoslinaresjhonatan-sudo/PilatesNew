import { safeAssetUrl } from '@/lib/api';
import type { ImageAsset, LandingSection } from '@/lib/types';

export type LandingResourceState = { loading: boolean; error: string | null; retry: () => void };
export type EditorialImage = ImageAsset & { src: string };

export function publishedSections(sections: LandingSection[]) {
  return sections
    .filter((section) => section.estado === 'ACTIVO')
    .sort((first, second) => (first.orden ?? 0) - (second.orden ?? 0) || first.titulo.localeCompare(second.titulo, 'es'));
}

export function editorialImages(images: ImageAsset[] = []): EditorialImage[] {
  return images
    .map((image) => ({ ...image, src: safeAssetUrl(image.url, '', image.id) }))
    .filter((image) => image.src);
}
