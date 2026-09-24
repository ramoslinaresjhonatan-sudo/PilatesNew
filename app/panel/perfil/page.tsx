import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Mi perfil' };
export default function ProfilePage() { redirect('/panel?perfil=editar'); }
