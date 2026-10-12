import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

function Progress({ className, value, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)} value={v} {...props}>
      <ProgressPrimitive.Indicator className={cn('h-full w-full flex-1 rounded-full bg-primary transition-transform duration-500', indicatorClassName)} style={{ transform: `translateX(-${100 - v}%)` }} />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
