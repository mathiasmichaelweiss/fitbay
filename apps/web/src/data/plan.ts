import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { planTick, type GoalPlan, type PlanPhase } from '@fitbay/calc';
import { api } from './api';
import { today, useProfile } from './hooks';
import { useNav } from '@/nav/store';

/** План целей от тренера (st.plan прототипа): у клиента свой документ PLAN. */
export const usePlan = () =>
  useQuery({ queryKey: ['plan'], queryFn: () => api.getOne<GoalPlan>('plan').catch(() => null) });

/** planTick прототипа: при выполненном условии фаза переключается сама. */
export function usePlanTick() {
  const { data: plan } = usePlan();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  useEffect(() => {
    if (!plan || !profile) return;
    const up = planTick(plan, profile.w, today(), Date.now());
    if (!up) return;
    const next = { ...plan, ...up };
    qc.setQueryData(['plan'], next);
    void api.putOne('plan', next).catch(() => {});
  }, [plan, profile, qc]);
}

/** Шаблоны планов тренера (type tpl, kind plan прототипа) в его коллекции templates. */
export interface PlanTpl {
  id: string;
  kind: 'plan';
  name: string;
  phases: PlanPhase[];
  at: number;
}
export const usePlanTpls = () => {
  const isTrainer = useNav((s) => s.isTrainer);
  return useQuery({
    queryKey: ['plan-tpls'],
    enabled: isTrainer,
    queryFn: () =>
      api
        .list<PlanTpl>('templates')
        .then((l) => l.filter((x) => x.kind === 'plan').sort((a, b) => b.at - a.at)),
  });
};

/** План клиента у тренера: чтение и запись по согласию (TRAINER_WRITABLE). */
export const useClientPlan = (cid: string) =>
  useQuery({
    queryKey: ['client-plan', cid],
    retry: false,
    queryFn: () => api.call<GoalPlan>('GET', `/users/${encodeURIComponent(cid)}/plan`).catch(() => null),
  });

export function usePlanOps(cid: string) {
  const qc = useQueryClient();
  const enc = encodeURIComponent(cid);
  const done = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['client-plan', cid] }),
      qc.invalidateQueries({ queryKey: ['plan-tpls'] }),
    ]);
  return {
    save: useMutation({
      mutationFn: (p: GoalPlan) => api.call('PUT', `/users/${enc}/plan`, p),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (p: GoalPlan | null) =>
        p ? api.call('PUT', `/users/${enc}/plan`, p) : api.call('DELETE', `/users/${enc}/plan`),
      onSuccess: done,
    }),
    tplAdd: useMutation({
      mutationFn: (t: Omit<PlanTpl, 'id'>) =>
        api.create('templates', { ...t, date: new Date().toISOString().slice(0, 10) }),
      onSuccess: done,
    }),
    tplDel: useMutation({ mutationFn: (id: string) => api.remove('templates', id), onSuccess: done }),
  };
}
