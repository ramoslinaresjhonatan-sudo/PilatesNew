type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  script?: string;
};

export function PageHero({ eyebrow, title, description, script }: PageHeroProps) {
  return (
    <header className="site-hero">
      <span className="site-hero__eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {(script || description) && <p className="site-hero__script">{script || description}</p>}
    </header>
  );
}
