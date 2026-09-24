type SkeletonKind = 'experiences' | 'memberships' | 'schedule' | 'community';

function Lines() {
  return <div className="landing-skeleton__lines"><span /><span /><span /></div>;
}

export function LandingSkeleton({ kind, label }: { kind: SkeletonKind; label: string }) {
  return (
    <div className={`landing-skeleton landing-skeleton--${kind}`} role="status" aria-label={label}>
      <span className="landing-skeleton__announcement">{label}</span>
      <div aria-hidden="true" className="landing-skeleton__layout">
        {kind === 'schedule' ? (
          <div className="schedule-spotlight-card">
            <div className="schedule-spotlight-card__image landing-skeleton__surface" />
            <div className="schedule-spotlight-card__details"><Lines /><Lines /><div className="landing-skeleton__button landing-skeleton__surface" /></div>
          </div>
        ) : kind === 'community' ? (
          <div className="reference-community-founder">
            <div className="reference-community-founder__portrait landing-skeleton__surface" />
            <div className="reference-community-founder__content"><Lines /><Lines /><div className="landing-skeleton__button landing-skeleton__surface" /></div>
          </div>
        ) : (
          [0, 1, 2].map((index) => (
            <div className={kind === 'memberships' ? 'reference-membership-card landing-skeleton__membership' : 'experience-card'} key={index}>
              <div className="experience-card__media landing-skeleton__surface" />
              <div className="experience-card__body"><Lines />{kind === 'memberships' && <><Lines /><div className="landing-skeleton__button landing-skeleton__surface" /></>}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
