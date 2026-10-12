import * as DialogPrimitive from '@radix-ui/react-dialog';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Button } from './button';

/** askConfirm() прототипа (#modal): панель снизу, «Оставить» слева, действие справа. Вместо window.confirm. */
interface Ask {
  text: string;
  yes?: string;
  no?: string;
  resolve: (v: boolean) => void;
}
const useAsk = create<{ ask: Ask | null; set: (a: Ask | null) => void }>((set) => ({ ask: null, set: (ask) => set({ ask }) }));

/** Спросить подтверждение. Тексты передаются уже переведенными; по умолчанию «Удалить» / «Оставить». */
export const askConfirm = (text: string, yes?: string, no?: string) =>
  new Promise<boolean>((resolve) => useAsk.getState().set({ text, yes, no, resolve }));

export function ConfirmHost() {
  const { t } = useTranslation();
  const { ask, set } = useAsk();
  const done = (v: boolean) => {
    ask?.resolve(v);
    set(null);
  };
  return (
    <DialogPrimitive.Root open={!!ask} onOpenChange={(o) => !o && done(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid="confirm"
          className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[480px] rounded-xl bg-[#1c1c1c] p-5 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4"
        >
          <DialogPrimitive.Title className="m-0 mb-4 text-[1.1rem] font-semibold">{ask?.text}</DialogPrimitive.Title>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" className="h-12" onClick={() => done(false)}>
              {ask?.no ?? t('Оставить')}
            </Button>
            <Button className="h-12" onClick={() => done(true)}>
              {ask?.yes ?? t('Удалить')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
