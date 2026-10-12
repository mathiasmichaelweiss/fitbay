import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { weekStart } from '@fitbay/calc';
import { Tile, Tiles } from '@/components/ui/tile';
import { loadActive, usePrograms, useProfile, useWorkouts } from '@/data/hooks';
import { useEx } from './exercises';
import { startWorkout, useTrain } from './store';
import { Library, ExerciseSheet } from './Library';
import { WorkoutSheet } from './WorkoutSheet';
import { ProgramsSheet, ProgramEditor } from './Programs';
import { HistorySheet } from './History';
import { AiTrainer } from './AiTrainer';
import { ActivitySheet, ActivityTile } from './Activity';

/** Раздел #train прототипа (renderTrain). */
export function Train() {
  const { t, i18n } = useTranslation();
  const { data: workouts = [] } = useWorkouts();
  const { data: programs = [] } = usePrograms();
  const { data: profile } = useProfile();
  const { db } = useEx();
  const { active, set } = useTrain();
  const [act, setAct] = useState(false);
  const locale = i18n.language === 'de' ? de : ru;

  useEffect(() => {
    if (useTrain.getState().loaded) return;
    useTrain.setState({ loaded: true });
    void loadActive().then((a) => a && !useTrain.getState().active && useTrain.setState({ active: a }));
  }, []);

  const wk = workouts.filter((w) => w.date >= weekStart()).length;
  const goal = +(profile?.act ?? 3) || 3;
  const last = workouts[0];
  const known = (id: string) => !!db?.EXM[id];

  const onStart = () => {
    if (active) return set({ wo: true });
    if (programs.length) return set({ prog: true, progEmpty: true });
    startWorkout(null, t('Тренировка'), t('кг'), known);
  };

  return (
    <Tiles data-testid="train">
      <Tile
        full
        color="orange"
        onClick={onStart}
        data-testid="t-start"
        label={t('ТРЕНИРОВКИ ЗА НЕДЕЛЮ')}
        value={
          <span>
            {wk}
            <span className="text-[.45em] opacity-60"> / {goal}</span>
          </span>
        }
        title={<span className="mt-1.5 block">{t(active ? 'Продолжить тренировку' : 'Начать тренировку')}</span>}
        sub={active ? `${active.items.length} ${t('упр.')} · ${Math.round((Date.now() - active.start) / 60000)} ${t('мин')}` : t('Пустая или по программе')}
      />
      <ActivityTile onOpen={() => setAct(true)} />
      <Tile color="cream" small onClick={() => set({ lib: true, pick: false })} data-testid="t-lib" label={t('БИБЛИОТЕКА')} value={db ? db.EX.length : 876} sub={t('упражнений')} />
      <Tile color="yellow" dot onClick={() => set({ prog: true, progEmpty: false })} data-testid="t-prog" title={t('Мои программы')} sub={`${programs.length} ${t('сохранено')}`} />
      <Tile full color="teal" className="min-h-[120px]" onClick={() => set({ ai: true })} data-testid="t-ai" label={t('» AI-ТРЕНЕР')} title={t('Составить программу')} sub={t('Под цель, уровень и место тренировок')} />
      <Tile full chevron className="min-h-[110px]" onClick={() => set({ hist: true })} data-testid="t-hist" label={t('ПОСЛЕДНЯЯ ТРЕНИРОВКА')}>
        <div className="mt-auto pt-2.5">
          {last ? (
            <>
              <b>{last.title}</b>
              <div className="mt-1 text-[0.85rem] opacity-70">
                {format(parseISO(last.date), 'EEE, d MMM', { locale })} · {last.items.length} {t('упр.')}
              </div>
            </>
          ) : (
            <span className="opacity-60">{t('Тренировок пока нет.')}</span>
          )}
        </div>
      </Tile>

      <ActivitySheet open={act} onClose={() => setAct(false)} />
      <WorkoutSheet />
      <ProgramsSheet />
      <ProgramEditor />
      <HistorySheet />
      <AiTrainer />
      <Library />
      <ExerciseSheet />
    </Tiles>
  );
}
