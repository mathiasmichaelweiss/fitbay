import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Label } from './label';

/** Подпись + поле. useId связывает label и input для доступности и тестов. */
function Field({ label, hint, className, ...props }: { label: string; hint?: React.ReactNode } & React.ComponentProps<typeof Input>) {
  const id = React.useId();
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {hint && <span className="text-xs opacity-70">{hint}</span>}
      </Label>
      <Input id={id} {...props} />
    </div>
  );
}

/** Подпись над произвольным контролом (сегмент, чипы, пикер). */
function FieldGroup({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)} role="group" aria-label={label}>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {label}
        {hint && <span className="text-xs opacity-70">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export { Field, FieldGroup };
