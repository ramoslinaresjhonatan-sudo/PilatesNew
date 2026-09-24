import { ManagementModule } from '@/features/panel/management-view';

export default async function ManagementModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <ManagementModule moduleSlug={module} />;
}
