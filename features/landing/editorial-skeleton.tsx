function Line({ className = '' }: { className?: string }) {
  return <span className={`landing-skeleton__line ${className}`.trim()} />;
}

/**
 * Mantiene reconocible el bloque de comunidad mientras llegan los datos.
 * Es propio de esta seccion: el resto de la landing usa `LandingSkeleton`.
 */
export function EditorialSkeleton({ variant }: { variant: 'gallery' | 'coach' }) {
  if (variant === 'gallery') return <div className="landing-skeleton landing-skeleton--gallery" role="status" aria-busy="true">
    <span className="sr-only">Cargando galería</span><div className="landing-skeleton__gallery-heading"><Line className="landing-skeleton__line--medium" /><Line className="landing-skeleton__line--small" /></div><div className="landing-skeleton__gallery-images"><span className="landing-skeleton__image" /><span className="landing-skeleton__image" /><span className="landing-skeleton__image" /></div>
  </div>;

  return <div className="landing-skeleton landing-skeleton--coach" role="status" aria-busy="true">
    <span className="sr-only">Cargando perfil de coach</span><span className="landing-skeleton__image" /><div><Line className="landing-skeleton__line--small" /><Line className="landing-skeleton__line--large" /><Line /><Line className="landing-skeleton__line--medium" /></div>
  </div>;
}
