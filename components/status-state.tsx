type StatusStateProps = {
  kind?: 'empty' | 'error' | 'loading' | 'info' | 'success';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatusState({ kind = 'empty', title, description, actionLabel, onAction }: StatusStateProps) {
  return (
    <div className={`status-state status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="status-mark" aria-hidden="true">
        {kind === 'error' ? '!' : kind === 'success' ? '✓' : kind === 'loading' ? '·' : '—'}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
