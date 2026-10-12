import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from './progress';

/** Кольцо прогресса (своё, в shadcn нет). value 0..1+, при перевыполнении красное. */
function Ring({ value, size = 168, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={value > 1 ? 'var(--red)' : 'var(--orange)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">{children}</div>
    </div>
  );
}

const BAR = { teal: 'bg-brand-teal', yellow: 'bg-brand-yellow', orange: 'bg-brand-orange' } as const;

/** Полоска БЖУ на базе shadcn Progress. */
function MacroBar({ label, eaten, goal, color, unit }: { label: string; eaten: number; goal: number; color: keyof typeof BAR; unit: string }) {
  const over = eaten > goal;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {eaten} / {goal} {unit}
        </span>
      </div>
      <Progress value={goal > 0 ? (eaten / goal) * 100 : 0} indicatorClassName={cn(over ? 'bg-brand-red' : BAR[color])} />
    </div>
  );
}

export { Ring, MacroBar };
