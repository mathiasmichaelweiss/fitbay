import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  'relative inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        // сегмент внутри серой капсулы: активный оранжевый
        segment: 'h-9 flex-1 text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
        // чип: активный бирюзовый контур; зона касания расширена до 44 px
        chip: "h-8 border px-3 font-medium text-foreground data-[state=on]:border-brand-teal data-[state=on]:bg-brand-teal/12 data-[state=on]:text-brand-teal after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']",
      },
    },
    defaultVariants: { variant: 'segment' },
  },
);

function Toggle({ className, variant, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, className }))} {...props} />;
}

export { Toggle, toggleVariants };
