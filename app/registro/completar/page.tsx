import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GoogleClientOnboarding } from '@/features/auth/google-client-onboarding';

export const metadata: Metadata = { title: 'Completar registro', robots: { index: false, follow: false } };

function safeNext(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || decoded.includes('\\') || /[\u0000-\u001f\u007f]/.test(decoded)) return null;
    const target = new URL(value, 'https://pilates-house.local');
    return target.origin === 'https://pilates-house.local' ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

export default async function CompleteGoogleRegistrationPage({ searchParams }: { searchParams: Promise<{ next?: string; google?: string }> }) {
  const query = await searchParams;
  if (query.google !== '1') redirect('/login');
  return <GoogleClientOnboarding nextPath={safeNext(query.next)} />;
}
