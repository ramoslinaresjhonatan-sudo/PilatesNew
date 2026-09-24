import Link from 'next/link';
import { PublicLayout } from '@/components/public-layout';
export default function UnauthorizedPage() { return <PublicLayout><section className="message-page"><span>403</span><p className="section-eyebrow">Acceso restringido</p><h1>Este espacio necesita otros permisos.</h1><p>Tu sesión es válida, pero tu rol no tiene acceso a esta sección.</p><div><Link className="button button-dark" href="/">Volver al inicio</Link><Link className="button button-outline" href="/login">Cambiar de cuenta</Link></div></section></PublicLayout>; }
