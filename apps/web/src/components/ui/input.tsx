import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-md border bg-secondary px-3 text-base text-foreground outline-none transition-[color,box-shadow] placeholder:text-muted-foreground disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
