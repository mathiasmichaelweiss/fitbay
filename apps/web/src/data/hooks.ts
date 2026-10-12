import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Checkin, Meal, Measure, Profile, Recipe } from '@fitbay/shared';
import { target, sum, type CalcProfile, type MacroSum, type Target } from '@fitbay/calc';
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
  return { target: profile ? target(profile as CalcProfile, date) : null, eaten: sum(meals), meals };
}
export const useCheckins = () => useQuery({ queryKey: ['checkins'], queryFn: () => api.list<Checkin>('checkins') });
