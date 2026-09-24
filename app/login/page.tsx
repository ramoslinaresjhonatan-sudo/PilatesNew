import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth/auth-form';

export const metadata: Metadata = { title: 'Ingresar', robots: { index: false, follow: false } };

function safeNext(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || decoded.includes('\\') || /[\u0000-\u001f]/.test(decoded)) return null;
    const target = new URL(value, 'https://pilates-house.local');
    return target.origin === 'https://pilates-house.local' ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; google?: string; google_error?: string }> }) {
  const query = await searchParams;
  return <AuthForm mode="login" nextPath={safeNext(query.next)} googleComplete={query.google === '1'} googleError={query.google_error || null} />;
}
