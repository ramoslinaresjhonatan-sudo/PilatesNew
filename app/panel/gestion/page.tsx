import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Panel' };
export default function ManagementPage() { redirect('/panel#modulos'); }
