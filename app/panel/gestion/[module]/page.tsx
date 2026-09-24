import { redirect } from 'next/navigation';
export default async function LegacyManagementModulePage({ params }: { params: Promise<{ module: string }> }) { const { module } = await params; redirect(`/panel/modulos/${encodeURIComponent(module)}`); }
