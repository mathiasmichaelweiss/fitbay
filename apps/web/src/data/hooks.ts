import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActiveWorkout, ActivityEntry, Checkin, Meal, Measure, Profile, Program, Recipe, Workout } from '@fitbay/shared';
import { target, sum, woKcal, curPhase, type CalcProfile, type DayContext, type GoalPlan, type MacroSum, type Target } from '@fitbay/calc';
import { api, type Collection } from './api';

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => api.getOne<Profile>('profile') });

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Profile) => api.putOne('profile', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

const useDay = <T>(e: Collection, date: string) =>
  useQuery({ queryKey: [e, date], queryFn: () => api.list<T>(e, { from: date, to: date }) });

export const useMeals = (date: string) => useDay<Meal>('meals', date);
export const useCheckin = (date: string) => {
  const q = useDay<Checkin>('checkins', date);
  return { ...q, data: q.data?.[0] ?? null };
};
export const useMeasures = () => useQuery({ queryKey: ['measures'], queryFn: () => api.list<Measure>('measures') });

function useCol<T>(e: Collection) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: [e] });
  return {
    create: useMutation({ mutationFn: (d: Partial<T> & { date: string }) => api.create<T>(e, d), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, ...d }: Partial<T> & { id: string }) => api.update<T>(e, id, d as Partial<T>), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.remove(e, id), onSuccess: done }),
  };
}
export const useMealOps = () => useCol<Meal>('meals');
export const useRecipes = () => useQuery({ queryKey: ['recipes'], queryFn: () => api.list<Recipe>('recipes') });
export const useRecipeOps = () => useCol<Recipe>('recipes');
export const useCheckinOps = () => useCol<Checkin>('checkins');
export const useMeasureOps = () => useCol<Measure>('measures');

/** Норма и съеденное за день. Все числа только из @fitbay/calc. Активности и фазы плана подключаются в A3.3/A4.3. */
export function useDaySummary(date: string): { target: Target | null; eaten: MacroSum; meals: Meal[] } {
  const { data: profile } = useProfile();
  const { data: meals = [] } = useMeals(date);
  const ctx = useDayCtx();
  return { target: profile ? target(profile as CalcProfile, date, ctx(date)) : null, eaten: sum(meals), meals };
}
export const useCheckins = () => useQuery({ queryKey: ['checkins'], queryFn: () => api.list<Checkin>('checkins') });

/** Еда за период (для «Жир за день» нужны прошлые дни, для календаря месяц). */
export const useMealsRange = (from: string, to: string) =>
  useQuery({ queryKey: ['meals', 'range', from, to], queryFn: () => api.list<Meal>('meals', { from, to }) });

/** Взвешивания для weightOn: замеры с весом. */
export function useWeighings() {
  const { data = [] } = useMeasures();
  return data.filter((m) => typeof m.weight === 'number').map((m) => ({ date: m.date, w: m.weight! }));
}

export const shiftDay = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Сохранённый совет коуча на день (COACH#<дата>). */
export const useCoach = (date: string) =>
  useQuery({ queryKey: ['coach', date], queryFn: () => api.call<{ text: string; key: string; at: number } | null>('GET', `/me/coach/${date}`).catch(() => null) });

/** Тренировки: история по убыванию окончания, программы по времени создания (initTrain прототипа). */
export const useWorkouts = () =>
  useQuery({ queryKey: ['workouts'], queryFn: async () => (await api.list<Workout>('workouts')).sort((a, b) => b.end - a.end) });
export const useWorkoutOps = () => useCol<Workout>('workouts');
export const usePrograms = () =>
  useQuery({ queryKey: ['programs'], queryFn: async () => (await api.list<Program>('programs')).sort((a, b) => (a.at || 0) - (b.at || 0)) });
export const useProgramOps = () => useCol<Program>('programs');
/** Сохраненная идущая тренировка (wo-active). {none:true} значит, что ее нет. */
export const loadActive = async (): Promise<ActiveWorkout | null> => {
  const d = await api.getOne<ActiveWorkout & { none?: boolean }>('active-workout');
  if (!d || d.none) return null;
  const rest: Record<string, unknown> = { ...d };
  delete rest.id;
  delete rest.createdAt;
  delete rest.updatedAt;
  return rest as unknown as ActiveWorkout;
};
export const saveActiveRemote = (a: ActiveWorkout | null) => api.putOne('active-workout', a ?? { none: true });

export const useActivities = () => useQuery({ queryKey: ['activities'], queryFn: () => api.list<ActivityEntry>('activities') });
export const useActivityOps = () => useCol<ActivityEntry>('activities');

/**
 * Контекст дня для нормы (CALC.actKcal, dayType прототипа): сожжено за день (тренировки + активности),
 * доля сожжённого из профиля, была ли тренировка. Все экраны с нормой берут его отсюда.
 */
export function useDayCtx(): (day: string) => DayContext {
  const { data: profile } = useProfile();
  const { data: workouts = [] } = useWorkouts();
  const { data: acts = [] } = useActivities();
  const { data: plan } = useQuery({ queryKey: ['plan'], queryFn: () => api.getOne<GoalPlan>('plan').catch(() => null) });
  const phase = curPhase(plan);
  const pct = profile?.actPct ?? 0.5;
  return (day) => {
    const wos = workouts.filter((w) => w.date === day);
    const actKcal = wos.reduce((k, w) => k + (woKcal(w.start, w.end, w.items, w.kcal, profile?.w) || 0), 0) + acts.filter((a) => a.date === day).reduce((k, a) => k + (+a.kcal || 0), 0);
    return { pct, actKcal, hasWorkout: wos.length > 0, phase };
  };
}
/** Сожжено по дням для dayStats. */
export function useActKcalByDay(): Record<string, number> {
  const ctx = useDayCtx();
  const { data: workouts = [] } = useWorkouts();
  const { data: acts = [] } = useActivities();
  const days = new Set([...workouts.map((w) => w.date), ...acts.map((a) => a.date)]);
  return Object.fromEntries([...days].map((d) => [d, ctx(d).actKcal ?? 0]));
}
