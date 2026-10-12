import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { PlusIcon } from 'lucide-react';
import { lastSets, libList, setsText } from '@fitbay/calc';
import type { Exercise } from '@fitbay/shared/exercises';
import { SheetPage } from '@/components/ui/sheet-page';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SingleToggle } from '@/components/ui/toggle-group';
import { useProgramDraft } from './Programs';
import { useWorkouts } from '@/data/hooks';
import { useEx } from './exercises';
import { addToWorkout, useTrain } from './store';

const COLORS = ['#FF5A0A', '#F2B705', '#F3EFE7', '#B2D8D8', '#7BC67B', '#F6B89A'];

/** exIcon() прототипа: картинка или цветной квадрат с первыми буквами мышцы. */
export function ExIcon({ e, size = 44 }: { e?: Exercise; size?: number }) {
  const { db, d } = useEx();
  if (!e) return null;
  const img = db?.EXIMG[e.i];
  if (img) return <img src={img} alt="" style={{ width: size, height: size }} className="block rounded-[12px] object-cover" />;
  return (
    <span style={{ width: size, height: size, background: COLORS[(e.p[0] || 'x').length % 6] }} className="grid flex-none place-items-center rounded-[12px] text-[0.8rem] font-bold text-[#111]">
      {d(e.p[0] || 'other').slice(0, 2)}
    </span>
  );
}

/** sh-lib прототипа: поиск, группы мышц, оборудование, список по 60. pick: «+» добавляет в тренировку или программу. */
export function Library() {
  const { t } = useTranslation();
  const { lib, pick, set, active } = useTrain();
  const { db, name, d } = useEx();
  const { data: workouts = [] } = useWorkouts();
  const addToProgram = useProgramDraft((s) => s.add);
  const [grp, setGrp] = useState('all');
  const [eq, setEq] = useState('all');
  const [q, setQ] = useState('');
  const [lim, setLim] = useState(60);
  if (!db) return null;
  const L = libList(db.EX, db.GROUPS.find((x) => x[0] === grp)?.[2] ?? null, eq, q, (e) => name(e));
  const add = (id: string) => {
    if (pick === 'prog') {
      addToProgram(id);
      set({ lib: false, pick: false });
    } else addToWorkout(id, active?.title ?? t('Тренировка'), lastSets(workouts, id));
  };

  return (
    <SheetPage open={lib} onOpenChange={(o) => !o && set({ lib: false, pick: false })} title={t('Библиотека упражнений')}>
      <Input
        value={q}
        onChange={(e) => (setQ(e.target.value), setLim(60))}
        placeholder={t('Поиск упражнения')}
        aria-label={t('Поиск упражнения')}
      />
      <SingleToggle className="mt-3" aria-label={t('Группа мышц')} value={grp} onChange={(k) => (setGrp(k), setLim(60))} options={db.GROUPS.map(([k, l]) => ({ value: k, label: t(l) }))} />
      <SingleToggle className="mt-2" aria-label={t('Оборудование')} value={eq} onChange={(k) => (setEq(k), setLim(60))} options={db.EQ.map(([k, l]) => ({ value: k, label: t(l) }))} />
      <div className="mb-1 mt-3 text-[0.8rem] opacity-55" data-testid="lib-count">
        {L.length} {t('упражнений')}
      </div>
      <Card className="gap-0 py-1.5">
        {L.slice(0, lim).map((e) => (
          <div key={e.i} className="flex items-center gap-3 border-t border-[#222] py-2.5 first:border-t-0" data-testid="exrow">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => set({ ex: e.i })}>
              <ExIcon e={e} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{name(e)}</span>
                <span className="mt-0.5 block text-[0.8rem] opacity-60">
                  {e.p.map(d).join(', ')} · {d(e.e)}
                </span>
              </span>
            </button>
            {pick && (
              <button type="button" aria-label={t('Добавить')} onClick={() => add(e.i)} className="grid size-11 flex-none place-items-center rounded-full bg-brand-orange text-[#111]">
                <PlusIcon className="size-6" strokeWidth={2.6} />
              </button>
            )}
          </div>
        ))}
      </Card>
      {L.length > lim && (
        <Button variant="secondary" className="mt-2.5 h-11 w-full" onClick={() => setLim(lim + 60)}>
          {t('Показать еще')}
        </Button>
      )}
    </SheetPage>
  );
}

/** sh-ex прототипа: картинка, метки, мышцы, техника, мои результаты, «Добавить в тренировку». */
export function ExerciseSheet() {
  const { t, i18n } = useTranslation();
  const { ex, active, set } = useTrain();
  const { db, name, d } = useEx();
  const { data: workouts = [] } = useWorkouts();
  const e = ex && db ? db.EXM[ex] : null;
  const locale = i18n.language === 'de' ? de : ru;
  const hist = e ? workouts.filter((w) => w.items.some((i) => i.id === e.i)).slice(0, 5) : [];
  return (
    <SheetPage open={!!e} onOpenChange={(o) => !o && set({ ex: null })} title={e ? name(e) : ''}>
      {e && (
        <>
          {db?.EXIMG[e.i] && <img src={db.EXIMG[e.i]} alt="" className="mb-3 w-full rounded-xl bg-[#111]" />}
          <div>
            {[d(e.c), d(e.l), d(e.e)].map((x) => (
              <span key={x} className="mb-1.5 mr-1.5 inline-block rounded-full bg-[#222] px-2.5 py-[5px] text-[0.8rem]">
                {x}
              </span>
            ))}
          </div>
          <Card className="mt-2 gap-0">
            <div className="text-[0.92rem] leading-normal">
              <b>{t('Основные мышцы')}:</b> {e.p.map(d).join(', ')}
              {e.s.length > 0 && (
                <>
                  <br />
                  <b>{t('Вспомогательные')}:</b> {e.s.map(d).join(', ')}
                </>
              )}
            </div>
            <div className="mt-3">
              <span className="text-sm text-muted-foreground">{t('Техника')}</span>
              <ol className="my-1.5 pl-5">
                {e.t.map((x, i) => (
                  <li key={i} className="mb-2">
                    {x}
                  </li>
                ))}
              </ol>
            </div>
            {hist.length > 0 && (
              <div className="mt-2" data-testid="ex-hist">
                <span className="text-sm text-muted-foreground">{t('Мои результаты')}</span>
                {hist.map((w) => (
                  <div key={w.id} className="py-1 text-[0.9rem]">
                    {format(parseISO(w.date), 'd MMM', { locale })}: {setsText(w.items.find((i) => i.id === e.i)?.sets, t('кг'))}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Button
            className="mt-4 w-full"
            onClick={() => addToWorkout(e.i, active?.title ?? t('Тренировка'), lastSets(workouts, e.i))}
          >
            {t(active ? 'Добавить в тренировку' : 'Начать тренировку с этим упражнением')}
          </Button>
        </>
      )}
    </SheetPage>
  );
}
