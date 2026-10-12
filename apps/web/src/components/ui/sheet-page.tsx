import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeftIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Полноэкранный лист (.sheet прототипа): заголовок, «назад» и круглый «×».
 * Для длинных сценариев (добавить еду, тренировка), где шторка снизу тесна. На Radix Dialog: фокус и Esc из коробки.
 */
function SheetPage({
  open,
  onOpenChange,
  title,
  onBack,
  backLabel = 'Назад',
  closeLabel = 'Закрыть',
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  closeLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-0 z-40 overflow-y-auto bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4',
            className,
          )}
        >
          <main className="mx-auto max-w-[520px] px-3.5 pb-10 pt-2.5">
            <div className="mx-1 mb-4 mt-1 flex items-center gap-1.5">
              {onBack && (
                <button type="button" onClick={onBack} aria-label={backLabel} className="grid size-9 place-items-center rounded-full bg-surface-3">
                  <ChevronLeftIcon className="size-5" />
                </button>
              )}
              <DialogPrimitive.Title className="m-0 flex-1 text-[1.4rem] font-semibold tracking-[-0.02em]">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close aria-label={closeLabel} className="grid size-9 place-items-center rounded-full bg-card text-xl">
                <XIcon className="size-5" />
              </DialogPrimitive.Close>
            </div>
            {children}
          </main>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { SheetPage };
