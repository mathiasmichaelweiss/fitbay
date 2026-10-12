import * as React from 'react';
import { cn } from '@/lib/utils';

/** .onbOpt прототипа: карточка выбора с цветной иконкой, выбранная обведена оранжевым. */
function OptionCard({
  icon,
  iconBg,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-[22px] border-2 border-transparent bg-card p-4 text-left transition-[border-color,transform] active:scale-[0.98]',
        selected && 'border-primary',
      )}
    >
      <span className="grid size-[46px] flex-none place-items-center rounded-[14px] text-[1.4rem]" style={{ background: iconBg }} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[1.05rem]">{title}</b>
        {sub && <span className="text-[0.82rem] leading-snug text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

export { OptionCard };
