type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  id?: string;
};

export function SectionHeading({ eyebrow, title, description, align = 'left', id }: SectionHeadingProps) {
  return (
    <header className={`section-heading section-heading-${align}`}>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {description && <p className="section-description">{description}</p>}
    </header>
  );
}
