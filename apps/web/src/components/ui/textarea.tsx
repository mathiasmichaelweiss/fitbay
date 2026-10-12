import * as React from 'react';
import { cn } from '@/lib/utils';

/** textarea прототипа: как поле ввода, высота от 60 px. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-[60px] w-full rounded-md border bg-secondary px-[13px] py-[11px] text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
