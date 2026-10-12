import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { sum, target, type CalcProfile } from '@fitbay/calc';
import { CapsRings, RC } from '@/components/ui/rings';
import { SheetPage } from '@/components/ui/sheet-page';
import { cn } from '@/lib/utils';
import { today, useMealsRange, useProfile } from '@/data/hooks';

/** «Календарь» прототипа (renderCal): месяц с кольцами по дням, будущие дни недоступны. */
export function CalendarSheet({ open, day, onPick, onClose }: { open: boolean; day: string; onPick: (d: string) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(day.slice(0, 7));
  const [y, m] = month.split('-').map(Number) as [number, number];
  const days = new Date(y, m, 0).getDate();
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const { data: meals = [] } = useMealsRange(`${month}-01`, `${month}-${String(days).padStart(2, '0')}`);
  const { data: profile } = useProfile();
  const td = today();
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const wd = i18n.language === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Календарь')}>
      <div className="rounded-xl bg-card p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <button type="button" aria-label={t('Назад')} onClick={() => shift(-1)} className="grid size-9 place-items-center rounded-full bg-surface-3">
            <ChevronLeftIcon className="size-5" />
          </button>
          <b className="capitalize">{new Date(y, m - 1, 1).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'ru-RU', { month: 'long', year: 'numeric' })}</b>
          <button type="button" aria-label={t('Дальше')} disabled={month >= td.slice(0, 7)} onClick={() => shift(1)} className="grid size-9 place-items-center rounded-full bg-surface-3 disabled:opacity-30">
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {wd.map((d) => (
            <div key={d} className="pb-1 text-[0.7rem] text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const ds = `${month}-${String(i + 1).padStart(2, '0')}`;
            const s = sum(meals.filter((x) => x.date === ds));
            const tg = profile ? target(profile as unknown as CalcProfile, ds) : null;
            const fut = ds > td;
            return (
              <button
                key={ds}
                type="button"
                disabled={fut}
                aria-label={ds}
                aria-current={ds === day ? 'date' : undefined}
                onClick={() => (onPick(ds), onClose())}
                className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1 text-[0.78rem]', ds === day && 'bg-[#2a2a2a]', fut && 'opacity-35')}
              >
                {tg ? <CapsRings size={34} items={[{ v: s.k, g: tg.k, c: RC.k }, { v: s.p, g: tg.p, c: RC.p }, { v: s.c, g: tg.c, c: RC.c }, { v: s.f, g: tg.f, c: RC.f }]} /> : <span className="size-[34px]" />}
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mx-1 my-3 text-[0.85rem] text-muted-foreground">{t('Внешний круг: калории, средний: белок, внутренний: углеводы. Нажми на день, чтобы открыть его.')}</p>
    </SheetPage>
  );
}
