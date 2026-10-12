import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  'relative inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        // .seg прототипа: серые пилюли, активная оранжевая с тёмным текстом; зона касания до 44 px
        segment:
          "h-9 bg-secondary px-[13px] text-[15px] font-normal text-foreground data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-on-color after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
        // .chipF прототипа: тёмные пилюли, активная кремовая
        chip: "h-9 bg-card px-3.5 text-sm font-normal text-foreground data-[state=on]:bg-brand-cream data-[state=on]:font-semibold data-[state=on]:text-on-color after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
      },
    },
    defaultVariants: { variant: 'segment' },
  },
);

function Toggle({ className, variant, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, className }))} {...props} />;
}

export { Toggle, toggleVariants };
