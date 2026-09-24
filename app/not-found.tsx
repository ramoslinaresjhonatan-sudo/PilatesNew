import Link from 'next/link';
import { PublicLayout } from '@/components/public-layout';
export default function NotFound() { return <PublicLayout><section className="message-page"><span>404</span><p className="section-eyebrow">Página no encontrada</p><h1>Este camino no lleva a la House.</h1><p>La dirección puede haber cambiado o ya no estar disponible.</p><div><Link className="button button-dark" href="/">Volver al inicio</Link><Link className="button button-outline" href="/galeria">Ver la galería</Link></div></section></PublicLayout>; }
