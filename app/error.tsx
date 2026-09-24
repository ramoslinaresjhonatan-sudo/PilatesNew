'use client';
import Link from 'next/link';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="message-page standalone-error"><span>!</span><p className="section-eyebrow">Algo salió mal</p><h1>No pudimos mostrar esta página.</h1><p>Intenta nuevamente. Si el problema continúa, vuelve al inicio.</p><div><button className="button button-dark" type="button" onClick={reset}>Reintentar</button><Link className="button button-outline" href="/">Ir al inicio</Link></div></main>; }
