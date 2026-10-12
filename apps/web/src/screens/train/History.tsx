import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { pvf, setsText, volume, woKcal, type PvfState } from '@fitbay/calc';
import type { Workout } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { askConfirm } from '@/components/ui/confirm';
import { useProfile, useWorkoutOps, useWorkouts } from '@/data/hooks';
import { useEx } from './exercises';
import { NoteView } from './WorkoutSheet';
import { editWorkout, useTrain } from './store';

const PVC: Record<PvfState, string> = { ok: '#7BC67B', over: '#5BC0BE', under: '#FF8A3D', miss: '#e5484d' };
const PVI: Record<PvfState, string> = { ok: '✓', over: '⬆', under: '↓', miss: '✕' };
const num = (n: number) => String(n).replace('.', ',');

/** pvfHtml() прототипа: таблица «План и факт». */
export function PlanFact({ w }: { w: Workout }) {
  const { t } = useTranslation();
  const { db, name } = useEx();
  const r = pvf(w, (id) => (db?.EXM[id] ? [db.EXM[id].n, name(id)] : []));
  if (!r) return null;
  return (
    <Card className="gap-0 bg-[#222]" data-testid="pvf">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('План и факт')}
          {r.week ? ` · ${t('неделя')} ${r.week}` : ''}
        </span>
        <b style={{ color: r.pct >= 95 ? '#7BC67B' : r.pct >= 70 ? '#FF8A3D' : '#e5484d' }}>{r.pct}%</b>
      </div>
      <div className="mt-2.5 grid grid-cols-[minmax(0,1.3fr)_1fr_1fr_22px] items-center gap-x-2 gap-y-1.5 text-[0.8rem]">
        <span className="text-muted-foreground">{t('Упражнение')}</span>
        <span className="text-muted-foreground">{t('План')}</span>
        <span className="text-muted-foreground">{t('Факт')}</span>
        <span />
        {r.rows.map((x, i) => (
          <div key={i} className="contents">
            <span className="truncate">{db?.EXM[x.pi.id] ? name(x.pi.id) : x.pi.id}</span>
            <span>
              {x.pi.sets}×{x.pi.reps}
              {x.pi.kg ? (
                <>
                  <br />
                  <span className="text-muted-foreground">
                    {num(x.pi.kg)} {t('кг')}
                  </span>
                </>
              ) : null}
            </span>
            <span>
              {x.S.length ? x.S.map((s) => s.r).join(', ') : '–'}
              {x.S.some((s) => +(s.w ?? 0)) && (
                <>
                  <br />
                  <span className="text-muted-foreground">
                    {num(Math.max(...x.S.map((s) => +(s.w ?? 0) || 0)))} {t('кг')}
                  </span>
                </>
              )}
            </span>
            <b className="text-center" style={{ color: PVC[x.st] }}>
              {PVI[x.st]}
            </b>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5 text-[0.7rem] text-muted-foreground">
        <span style={{ color: PVC.ok }}>✓ {t('выполнено')}</span>
        <span style={{ color: PVC.over }}>⬆ {t('перевыполнено')}</span>
        <span style={{ color: PVC.under }}>↓ {t('меньше плана')}</span>
        <span style={{ color: PVC.miss }}>✕ {t('пропущено')}</span>
      </div>
    </Card>
  );
}

/** sh-hist прототипа (renderHist): последние 40 тренировок, раскрываются, «Изменить» и «Удалить». */
export function HistorySheet() {
  const { t, i18n } = useTranslation();
  const { hist, set } = useTrain();
  const { data: workouts = [] } = useWorkouts();
  const { data: profile } = useProfile();
  const { remove } = useWorkoutOps();
  const { db, name } = useEx();
  const locale = i18n.language === 'de' ? de : ru;
  return (
    <SheetPage open={hist} onOpenChange={(o) => !o && set({ hist: false })} title={t('История тренировок')}>
      {workouts.length ? (
        workouts.slice(0, 40).map((w) => {
          const vol = volume(w.items);
          const min = Math.round((w.end - w.start) / 60000);
          const pain = (w.tags ?? []).includes('pain') || w.items.some((i) => (i.tags ?? []).includes('pain'));
          const note = w.note || w.items.some((i) => i.note);
          return (
            <details key={w.id} className="group mb-2.5 rounded-xl bg-card p-4" data-testid="hist-item">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex justify-between">
                  <b>{w.title}</b>
                  <span className="text-[0.85rem] opacity-60">{format(parseISO(w.date), 'd MMM', { locale })}</span>
                </div>
                {pain ? (
                  <span className="float-right mt-1 rounded-full bg-[rgba(229,72,77,.18)] px-2 py-[3px] text-[0.7rem]">🤕</span>
                ) : note ? (
                  <span className="float-right mt-1">💬</span>
                ) : null}
                <div className="mt-1 text-[0.8rem] opacity-60">
                  {w.items.length} {t('упр.')} · {min} {t('мин')}
                  {vol ? ` · ${Math.round(vol)} ${t('кг объем')}` : ''} · ~{woKcal(w.start, w.end, w.items, w.kcal, profile?.w)} kcal
                </div>
              </summary>
              {w.plan && (
                <div className="mt-2.5">
                  <PlanFact w={w} />
                </div>
              )}
              <div className="mt-2.5 text-[0.9rem]">
                <NoteView o={w} />
                {w.items.map((i, k) => (
                  <div key={k} className="py-1">
                    {db?.EXM[i.id] ? name(i.id) : i.name}: {setsText(i.sets, t('кг'))}
                    <NoteView o={i} />
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-2 h-11 rounded-[14px]" onClick={() => editWorkout(w, (id) => !!db?.EXM[id])}>
                {t('Изменить')}
              </Button>{' '}
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 h-11 rounded-[14px] text-brand-orange"
                onClick={async () => {
                  if (await askConfirm(t('Удалить тренировку из истории?'))) remove.mutate(w.id);
                }}
              >
                {t('Удалить')}
              </Button>
            </details>
          );
        })
      ) : (
        <p className="opacity-60">{t('Тренировок пока нет.')}</p>
      )}
    </SheetPage>
  );
}
