import type { Metadata, Viewport } from 'next';
import './globals.css';
import './fidelity.css';
import './landing-fidelity.css';
import './public-pages-fidelity.css';
import './auth-fidelity.css';
import './panel-fidelity.css';
// Section layouts share the tokens defined in brand-theme.css.
import './landing-boutique.css';
import './landing-shell.css';
import './landing-editorial.css';
import './client-house.css';
import './reception-house.css';

function getSiteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173');
  } catch {
    return new URL('http://localhost:5173');
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: 'Pilates House · Hot Pilates',
    template: '%s | Pilates House',
  },
  description:
    'Movimiento consciente, fuerza y comunidad. Descubre Hot Pilates, sesiones de recuperación y membresías Pilates House.',
  applicationName: 'Pilates House',
  icons: { icon: '/img/PH.svg' },
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    siteName: 'Pilates House',
    title: 'Pilates House | Hot Pilates en Santa Cruz',
    description: 'Movimiento consciente, fuerza y comunidad en un espacio creado para vos.',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pilates House — Hot Pilates' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-card.png'] },
};

export const viewport: Viewport = {
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
