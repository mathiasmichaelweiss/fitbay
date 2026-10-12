import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { toggleVariants } from './toggle';

const Ctx = React.createContext<VariantProps<typeof toggleVariants>>({ variant: 'segment' });

function ToggleGroup({
  className,
  variant = 'segment',
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(variant === 'segment' ? 'flex w-full gap-1 rounded-full bg-secondary p-1' : 'flex flex-wrap gap-2', className)}
      {...props}
    >
      <Ctx.Provider value={{ variant }}>{children}</Ctx.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const { variant } = React.useContext(Ctx);
  return <ToggleGroupPrimitive.Item data-slot="toggle-group-item" className={cn(toggleVariants({ variant }), className)} {...props} />;
}

/** Обёртка: одиночный выбор, который нельзя снять повторным нажатием (как сегмент в прототипе). */
function SingleToggle<T extends string>({
  value,
  onChange,
  options,
  variant = 'segment',
  className,
  ...rest
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  'aria-label'?: string;
} & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroup type="single" variant={variant} value={value} onValueChange={(v) => v && onChange(v as T)} className={className} aria-label={rest['aria-label']}>
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} aria-label={typeof o.label === 'string' ? o.label : o.value}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export { ToggleGroup, ToggleGroupItem, SingleToggle };
