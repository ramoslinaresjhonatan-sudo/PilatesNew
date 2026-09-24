type SocialIconProps = {
  name: 'instagram' | 'facebook' | 'tiktok' | 'whatsapp';
};

const lineProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.8,
};

export function SocialIcon({ name }: SocialIconProps) {
  if (name === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...lineProps}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.8-.1-1.6-.2-2.4-.2-2.4 0-4 1.5-4 4.1v2.3H8V13h2.6v8h3.1Z" />
      </svg>
    );
  }

  if (name === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M15.3 3c.3 2 1.4 3.3 3.5 3.7v3.1a8 8 0 0 1-3.5-1v6.1a6 6 0 1 1-5.2-5.9v3.2a2.9 2.9 0 1 0 2.1 2.8V3h3.1Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...lineProps}>
      <path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.4a8.4 8.4 0 1 1 15.6-4.4Z" />
      <path d="M8.3 7.8c.3-.7.7-.7 1-.7h.4c.2 0 .4.1.5.4l.8 2c.1.3 0 .5-.1.7l-.6.7c-.2.2-.1.4 0 .6.7 1.3 1.8 2.4 3.2 3 .2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .5-.2 1.5-1 2.1-.7.6-1.7.8-2.8.5-1.6-.4-3.6-1.4-5.2-3-1.3-1.3-2.4-3-2.7-4.5-.2-.8.2-1.5.5-1.9Z" />
    </svg>
  );
}
