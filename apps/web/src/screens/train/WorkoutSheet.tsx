import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { CheckIcon, XIcon } from 'lucide-react';
import { addSet, finishItems, lastSets, setsText, toggleDone, toggleTag, woKcal } from '@fitbay/calc';
import type { ActiveWorkout } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { askConfirm } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';
import { today, useProfile, useProgramOps, useWorkoutOps, useWorkouts } from '@/data/hooks';
import { useEx } from './exercises';
import { ExIcon } from './Library';
import { endEdit, useTrain } from './store';

type Note = { tags?: string[]; note?: string; noteOpen?: boolean };

/** wnoteView() прототипа: метки и комментарий в истории. */
export function NoteView({ o }: { o?: Note }) {
  const { t } = useTranslation();
  const { db } = useEx();
  if (!o || (!(o.tags ?? []).length && !o.note)) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {(o.tags ?? []).map((k) => {
        const w = db?.WTAGS.find((x) => x[0] === k);
        return w ? (
          <span key={k} className={cn('rounded-full bg-white/[.07] px-2 py-[3px] text-[0.7rem] text-[#ccc]', k === 'pain' && 'bg-[rgba(229,72,77,.18)] text-[#ff8a8d]')}>
            {w[1]} {t(w[2])}
          </span>
        ) : null;
      })}
      {o.note && <span className="w-full text-[0.8rem] text-[#bbb]">💬 {o.note}</span>}
    </div>
  );
}

/** wnoteEd() прототипа: «💬 Комментарий» раскрывается в метки и поле. all: журнал всей тренировки. */
function NoteEd({ all, o, onChange }: { all?: boolean; o: Note; onChange: (o: Note) => void }) {
  const { t } = useTranslation();
  const { db } = useEx();
  const open = o.noteOpen || (o.tags ?? []).length || o.note;
  if (!open)
    return (
      <button type="button" className="mt-2.5 min-h-11 text-left text-[0.8rem] text-muted-foreground" onClick={() => onChange({ ...o, noteOpen: true })}>
        💬 {t(all ? 'Комментарий к тренировке' : 'Комментарий')}
      </button>
    );
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {db?.WTAGS.map(([k, ic, n]) => {
          const on = (o.tags ?? []).includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...o, tags: toggleTag(o.tags, k), noteOpen: true })}
              className={cn('min-h-9 rounded-full bg-white/[.06] px-2.5 py-1.5 text-[0.76rem] text-[#ddd]', on && 'bg-brand-teal font-bold text-[#111]', on && k === 'pain' && 'bg-[#e5484d] text-white')}
            >
              {ic} {t(n)}
            </button>
          );
        })}
      </div>
      <Textarea
        rows={2}
        className="mt-2 text-[0.88rem]"
        value={o.note ?? ''}
        aria-label={t(all ? 'Комментарий к тренировке' : 'Комментарий')}
        placeholder={t(all ? 'Как прошла тренировка? Самочувствие, что было сложно…' : 'Например: тянет правое плечо на последних повторах')}
        onChange={(e) => onChange({ ...o, note: e.target.value })}
      />
    </div>
  );
}

const mins = (a: number, b: number) => Math.max(0, Math.round((b - a) / 60000));

/** sh-wo прототипа: идущая тренировка или редактирование записи из истории. */
export function WorkoutSheet() {
  const { t, i18n } = useTranslation();
  const { active: a, wo, set, edit, setActive } = useTrain();
  const { db, name } = useEx();
  const { data: workouts = [] } = useWorkouts();
  const { data: profile } = useProfile();
  const ops = useWorkoutOps();
  const progOps = useProgramOps();
  const [asProg, setAsProg] = useState(false);
  const [err, setErr] = useState('');
  const [, tick] = useState(0);
  const locale = i18n.language === 'de' ? de : ru;
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => setErr(''), [wo]);
  if (!a || !db) return null;
  const isEdit = !!a.editId;
  const close = () => (isEdit ? endEdit() : set({ wo: false }));
  const setItem = (ii: number, fn: (x: ActiveWorkout['items'][number]) => ActiveWorkout['items'][number]) =>
    edit((x) => ({ ...x, items: x.items.map((it, k) => (k === ii ? fn(it) : it)) }));

  const cancel = async () => {
    if (isEdit) return endEdit();
    if (await askConfirm(t('Отменить тренировку? Записанные подходы не сохранятся.'))) {
      setActive(null);
      set({ wo: false });
    }
  };
  const finish = async () => {
    const items = finishItems(a.items, (id) => name(id));
    const wn = { tags: a.tags ?? [], note: (a.note ?? '').trim() };
    if (!items.length) return setErr(t('Отметь хотя бы один выполненный подход галочкой.'));
    setErr('');
    try {
      if (isEdit) {
        await ops.update.mutateAsync({ id: a.editId as string, title: a.title || t('Тренировка'), items, ...wn });
        return endEdit();
      }
      const now = Date.now();
      await ops.create.mutateAsync({
        date: today(),
        start: a.start,
        end: now,
        title: a.title || t('Тренировка'),
        items,
        ...wn,
        ...(a.plan ? { plan: a.plan } : {}),
        progId: a.progId || null,
        kcal: woKcal(a.start, now, items, undefined, profile?.w),
      });
      if (asProg)
        await progOps.create.mutateAsync({
          date: today(),
          name: a.title || t('Тренировка'),
          items: a.items.map((it) => ({ id: it.id, sets: it.sets.length, reps: it.target || '' })),
          src: 'me',
          at: now,
        });
      setActive(null);
      setAsProg(false);
      set({ wo: false });
    } catch {
      setErr(t('Не удалось сохранить.'));
    }
  };

  return (
    <SheetPage
      open={wo}
      onOpenChange={(o) => !o && close()}
      title={<Input value={a.title} aria-label={t('Название тренировки')} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} className="h-auto border-0 bg-transparent p-0 text-[1.2rem] font-bold" />}
    >
      <div className="-mt-1.5 mb-3 text-[0.85rem] opacity-60" data-testid="wo-time">
        ⏱ {a.forClient ? `🤝 ${a.forClient.name} · ` : ''}
        {isEdit
          ? `${format(a.start, 'EEE, d MMMM', { locale })} · ${mins(a.start, a.end ?? a.start)} ${t('мин')} · ${t('редактирование')}`
          : `${mins(a.start, Date.now())} ${t('мин')}`}
      </div>

      {a.items.length ? (
        <>
          {a.items.map((it, ii) => {
            const e = db.EXM[it.id];
            const prev = lastSets(workouts, it.id);
            return (
              <Card key={ii} className="mb-3 gap-0" data-testid="woex">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => set({ ex: it.id })}>
                    <ExIcon e={e} size={48} />
                    <b>{name(it.id)}</b>
                  </button>
                  <button
                    type="button"
                    aria-label={t('Удалить')}
                    className="grid size-11 flex-none place-items-center opacity-50"
                    onClick={async () => {
                      if (await askConfirm(t('Убрать упражнение из тренировки?'))) edit((x) => ({ ...x, items: x.items.filter((_, k) => k !== ii) }));
                    }}
                  >
                    <XIcon className="size-5" />
                  </button>
                </div>
                <div className="mb-2 mt-0.5 text-[0.8rem] opacity-60">
                  {it.target ? `${t('Цель')}: ${it.target} · ` : ''}
                  {prev.length ? `${t('Прошлый раз')}: ${setsText(prev, t('кг'))}` : t('Первый раз')}
                </div>
                <div className="mb-1 grid grid-cols-[28px_1fr_1fr_44px] items-center gap-2 text-[0.75rem] opacity-55">
                  <span>#</span>
                  <span>{t('Повт.')}</span>
                  <span>{t('Кг')}</span>
                  <span />
                </div>
                {it.sets.map((s, si) => (
                  <div key={si} className="mb-1.5 grid grid-cols-[28px_1fr_1fr_44px] items-center gap-2" data-testid="setrow">
                    <span>{si + 1}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label={`${t('Повт.')} ${si + 1}`}
                      value={s.r}
                      placeholder={prev[si] ? String(prev[si].r) : it.target || ''}
                      className={cn('px-2.5 text-center', s.d && 'bg-[#1f3a1f]')}
                      onChange={(ev) => setItem(ii, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? { ...y, r: ev.target.value } : y)) }))}
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      aria-label={`${t('Кг')} ${si + 1}`}
                      value={s.w}
                      placeholder={prev[si]?.w ? String(prev[si].w) : '0'}
                      className={cn('px-2.5 text-center', s.d && 'bg-[#1f3a1f]')}
                      onChange={(ev) => setItem(ii, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? { ...y, w: ev.target.value } : y)) }))}
                    />
                    <button
                      type="button"
                      aria-pressed={s.d}
                      aria-label={`${t('Подход')} ${si + 1}`}
                      onClick={() => setItem(ii, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? toggleDone(x, si, prev) : y)) }))}
                      className={cn('grid h-11 place-items-center rounded-[12px] bg-[#222] font-bold', s.d && 'bg-[#7BC67B] text-[#111]')}
                    >
                      <CheckIcon className="size-5" strokeWidth={3} />
                    </button>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" className="h-11 flex-1" onClick={() => setItem(ii, addSet)}>
                    + {t('Подход')}
                  </Button>
                  {it.sets.length > 1 && (
                    <Button variant="secondary" className="h-11 px-3.5" aria-label={t('Убрать подход')} onClick={() => setItem(ii, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>
                      −
                    </Button>
                  )}
                </div>
                <NoteEd o={it} onChange={(o) => setItem(ii, (x) => ({ ...x, ...o }))} />
              </Card>
            );
          })}
          <Card className="mb-3 gap-0">
            <span className="text-sm text-muted-foreground">{t('Журнал тренировки')}</span>
            <NoteEd all o={a} onChange={(o) => edit((x) => ({ ...x, ...o }))} />
          </Card>
        </>
      ) : (
        <p className="opacity-60">{t('Добавь первое упражнение.')}</p>
      )}

      <Button variant="secondary" className="h-[52px] w-full" onClick={() => set({ lib: true, pick: 'wo' })}>
        + {t('Упражнение')}
      </Button>
      {!isEdit && (
        <label className="mt-4 flex min-h-11 items-center gap-2.5">
          <Checkbox checked={asProg} onCheckedChange={(v) => setAsProg(v === true)} />
          <span>{t('Сохранить как программу')}</span>
        </label>
      )}
      {err && (
        <div role="alert" className="mt-2 text-sm text-brand-orange">
          {err}
        </div>
      )}
      <Button className="mt-4 w-full" onClick={finish} disabled={ops.create.isPending || ops.update.isPending}>
        {t(isEdit ? 'Сохранить изменения' : 'Завершить тренировку')}
      </Button>
      <Button variant="outline" className="mt-2.5 h-[52px] w-full rounded-lg border-[#333] text-brand-orange" onClick={cancel}>
        {t(isEdit ? 'Отменить изменения' : 'Отменить тренировку')}
      </Button>
    </SheetPage>
  );
}

/** #woBar прототипа: плашка идущей тренировки, когда лист закрыт. */
export function WoBar() {
  const { t } = useTranslation();
  const { active: a, wo, set } = useTrain();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!a || a.editId || wo) return null;
  const n = a.items.reduce((x, i) => x + i.sets.length, 0);
  const d = a.items.reduce((x, i) => x + i.sets.filter((z) => z.d).length, 0);
  const sec = Math.max(0, Math.floor((now - a.start) / 1e3));
  const m = `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  return (
    <div className="sticky top-0 z-30 -mx-[14px] bg-background px-3 py-2" data-testid="wobar">
      <button
        type="button"
        onClick={() => set({ wo: true })}
        className="flex w-full items-center gap-3 rounded-[18px] border-[1.5px] border-brand-orange bg-[linear-gradient(90deg,#2a1608,#1c1c1c_70%)] px-3 py-2.5 text-left text-white"
      >
        <span className="relative grid size-9 flex-none place-items-center rounded-full bg-brand-orange text-[1.1rem]">
          {a.forClient ? '🤝' : '🏋️'}
          <span aria-hidden className="absolute -inset-1 animate-ping rounded-full border-2 border-brand-orange opacity-50 motion-reduce:animate-none" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[0.92rem]">
            {a.forClient ? `${a.forClient.name} · ` : ''}
            {a.title || t('Тренировка')}
          </b>
          <small className="mt-px block text-[0.74rem] text-muted-foreground">
            <span className="text-brand-orange">●</span> {t('идёт')} <span className="tabular-nums">{m}</span> · {d}/{n} {t('подходов')}
          </small>
        </span>
        <span className="flex-none rounded-full bg-brand-orange px-3 py-[7px] text-[0.8rem] font-bold text-[#111]">{t('Открыть')}</span>
      </button>
    </div>
  );
}
