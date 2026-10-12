import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from './calendar';
import { Drawer, DrawerContent, DrawerTitle } from './drawer';
import { Button } from './button';

const LOCALES = { ru, de } as const;
const toISO = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Выбор даты: кнопка-поле открывает шторку с календарём.
 * Нативный <input type="date"> не используем: он выглядит по-разному на iOS и Android.
 */
function DatePicker({
  id,
  value,
  onChange,
  lang = 'ru',
  placeholder,
  title,
  min,
  max,
  doneLabel = 'OK',
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string; // YYYY-MM-DD или ''
  onChange: (v: string) => void;
  lang?: string;
  placeholder?: string;
  title: string;
  min?: string;
  max?: string;
  doneLabel?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const locale = LOCALES[lang as keyof typeof LOCALES] ?? ru;
  const selected = value ? parseISO(value) : undefined;
  const [month, setMonth] = React.useState<Date>(selected ?? (max ? parseISO(max) : new Date()));
  const [draft, setDraft] = React.useState<Date | undefined>(selected);

  const openPicker = () => {
    setDraft(selected);
    setMonth(selected ?? new Date(new Date().getFullYear() - 30, 0, 1));
    setOpen(true);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onClick={openPicker}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-md border bg-secondary px-3 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
          !value && 'text-muted-foreground',
        )}
      >
        <span>{selected ? format(selected, 'd MMMM yyyy', { locale }) : placeholder}</span>
        <CalendarIcon className="size-4 opacity-60" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerTitle className="mb-3">{title}</DrawerTitle>
          <Calendar
            mode="single"
            locale={locale}
            weekStartsOn={1}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            selected={draft}
            onSelect={setDraft}
            startMonth={min ? parseISO(min) : new Date(1930, 0)}
            endMonth={max ? parseISO(max) : new Date(new Date().getFullYear() + 1, 11)}
            disabled={[...(min ? [{ before: parseISO(min) }] : []), ...(max ? [{ after: parseISO(max) }] : [])]}
          />
          <Button
            className="mt-4 w-full"
            disabled={!draft}
            onClick={() => {
              if (draft) onChange(toISO(draft));
              setOpen(false);
            }}
          >
            {doneLabel}
          </Button>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export { DatePicker };
