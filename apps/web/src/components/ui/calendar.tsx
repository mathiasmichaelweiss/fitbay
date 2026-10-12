import * as React from 'react';
import { DayPicker, type DropdownProps } from 'react-day-picker';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/** Месяц и год выбираются кастомным Select, а не нативным <select> из react-day-picker. */
function CalendarDropdown({ value, onChange, options, 'aria-label': label }: DropdownProps) {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
    >
      <SelectTrigger data-vaul-no-drag aria-label={label} className="h-9 w-auto min-w-[88px] gap-1 rounded-full border-0 bg-secondary px-3 text-sm font-semibold capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="w-auto min-w-[var(--radix-select-trigger-width)]">
        {options?.map((o) => (
          <SelectItem key={o.value} value={String(o.value)} disabled={o.disabled} className="capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      // внутри шторки календарь не должен начинать перетаскивание (vaul)
      data-vaul-no-drag=""
      showOutsideDays={showOutsideDays}
      className={cn('w-full', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'flex w-full flex-col gap-3',
        // полоса навигации лежит поверх подписи: клики проходят сквозь неё, ловят только стрелки
        nav: 'pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between [&>button]:pointer-events-auto',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-9 z-10'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-9 z-10'),
        month_caption: 'flex h-9 items-center justify-center px-10',
        dropdowns: 'flex items-center gap-2',
        caption_label: 'text-sm font-semibold capitalize',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex-1 text-center text-xs font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative flex-1 p-0 text-center',
        day_button:
          'mx-auto grid size-11 place-items-center rounded-full text-base outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:font-semibold',
        today: '[&>button]:text-brand-orange [&>button]:font-semibold',
        outside: 'opacity-40',
        disabled: 'opacity-30 [&>button]:pointer-events-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeftIcon className="size-5" /> : <ChevronRightIcon className="size-5" />,
        Dropdown: CalendarDropdown,
      }}
      {...props}
    />
  );
}

export { Calendar };
