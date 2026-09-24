import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth-guard';
import { SiteHeader } from '@/components/site-header';
import { MembershipPaymentView } from '@/features/membership/membership-payment-view';

export const metadata: Metadata = {
  title: 'Pago de membresía',
  robots: { index: false, follow: false },
};

export default async function MembershipPaymentPage({ params }: { params: Promise<{ planSlug: string }> }) {
  const { planSlug } = await params;
  return (
    <div className="payment-site">
      <SiteHeader variant="solid" compact />
      <AuthGuard><MembershipPaymentView planSlug={planSlug} /></AuthGuard>
    </div>
  );
}
