import * as React from 'react';
import { cn } from '@/lib/utils';

const TONES = { orange: 'text-brand-orange', yellow: 'text-brand-yellow', teal: 'text-brand-teal' } as const;

/** Плитка из прототипа: подпись сверху, крупное значение снизу. */
function Tile({ label, value, tone, onClick, className }: { label: string; value: React.ReactNode; tone?: keyof typeof TONES; onClick?: () => void; className?: string }) {
  const cls = cn('flex min-h-[88px] flex-col justify-between rounded-lg border bg-card p-3 text-left', onClick && 'transition-colors hover:bg-accent', className);
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xl font-bold tabular-nums', tone && TONES[tone])}>{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" data-slot="tile" className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div data-slot="tile" className={cls}>
      {body}
    </div>
  );
}

function Tiles({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid grid-cols-2 gap-3', className)} {...props} />;
}

export { Tile, Tiles };
