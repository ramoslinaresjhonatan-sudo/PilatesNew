import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function PublicLayout({ children, tone = 'light', compactHeader = false }: { children: React.ReactNode; tone?: 'light' | 'dark'; compactHeader?: boolean }) {
  return (
    <main className={`site-page site-page--${tone}`}>
      <SiteHeader variant="solid" compact={compactHeader} />
      {children}
      <SiteFooter />
    </main>
  );
}
