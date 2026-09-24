import { redirect } from 'next/navigation';

export default async function LegacyAffiliationPage({ params }: { params: Promise<{ planSlug: string }> }) {
  const { planSlug } = await params;
  redirect(`/afiliacion/${encodeURIComponent(planSlug)}`);
}
