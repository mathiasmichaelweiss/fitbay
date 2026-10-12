import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** .tile прототипа: цветная плитка, радиус 24, подпись капсом сверху, крупное число снизу. */
const tileVariants = cva('relative flex min-h-[150px] min-w-0 flex-col rounded-xl p-4 text-left', {
  variants: {
    color: {
      orange: 'bg-brand-orange text-on-color',
      cream: 'bg-brand-cream text-on-color',
      yellow: 'bg-brand-yellow text-on-color',
      teal: 'bg-brand-teal text-on-color',
      peach: 'bg-brand-peach text-on-color',
      green: 'bg-brand-green text-white',
      dark: 'bg-card text-foreground',
    },
    full: { true: 'col-span-full' },
  },
  defaultVariants: { color: 'dark' },
});

type TileProps = VariantProps<typeof tileVariants> & {
  label?: React.ReactNode;
  value?: React.ReactNode;
  /** Меньшее число (.num.s) */
  small?: boolean;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  /** Точка в правом верхнем углу (.dot) */
  dot?: boolean;
  /** Чип «›» справа сверху: плитка открывает экран */
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
};

function Tile({ color, full, label, value, small, title, sub, dot, chevron, onClick, disabled, className, children, ...rest }: TileProps) {
  const cls = cn(tileVariants({ color, full }), onClick && 'transition-transform active:scale-[0.98] disabled:opacity-45', className);
  const muted = color === 'dark' || color === 'green' || !color;
  const body = (
    <>
      {label && <span className={cn('text-[0.68rem] font-semibold uppercase tracking-[0.06em]', muted ? 'text-muted-foreground' : 'opacity-75')}>{label}</span>}
      {dot && <span aria-hidden className="absolute right-4 top-4 size-3 rounded-full bg-black/55" />}
      {chevron && <span aria-hidden className="absolute right-3.5 top-3.5 rounded-full bg-black/10 px-2.5 py-0.5 text-[0.7rem] font-semibold">›</span>}
      {children}
      {value !== undefined && <span className={cn('mt-auto font-semibold leading-none tracking-[-0.04em] tabular-nums', small ? 'text-[2.6rem]' : 'text-[3.6rem]')}>{value}</span>}
      {title && <span className={cn('text-[1.05rem] font-semibold', value === undefined && 'mt-auto')}>{title}</span>}
      {sub && <span className="mt-1.5 text-[0.85rem] opacity-75">{sub}</span>}
    </>
  );
  return onClick ? (
    <button type="button" data-slot="tile" className={cls} onClick={onClick} disabled={disabled} data-testid={rest['data-testid']}>
      {body}
    </button>
  ) : (
    <div data-slot="tile" className={cls} data-testid={rest['data-testid']}>
      {body}
    </div>
  );
}

/** .grid прототипа: две колонки, зазор 10. */
function Tiles({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid grid-cols-2 gap-2.5', className)} {...props} />;
}

export { Tile, Tiles, tileVariants };
