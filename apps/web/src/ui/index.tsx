import { useEffect, type ReactNode } from 'react';
import './ui.css';

type Tone = 'orange' | 'yellow' | 'teal';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}

export function Tile({ label, value, tone, onClick }: { label: string; value: ReactNode; tone?: Tone; onClick?: () => void }) {
  const cls = `tile${tone ? ` tile--${tone}` : ''}`;
  const body = (
    <>
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Button({
  children,
  variant = 'primary',
  block,
  ...rest
}: { variant?: 'primary' | 'ghost'; block?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['btn', variant === 'ghost' && 'btn--ghost', block && 'btn--block'].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className="seg__item" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={!!active} onClick={onClick}>
      {children}
    </button>
  );
}

export function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="field__input" {...rest} />
    </label>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        {title && <h2 className="sheet__title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
