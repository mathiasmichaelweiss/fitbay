import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Checkin } from '@fitbay/shared';
import type { ClDay } from '@fitbay/calc';
import { api } from './api';
import type { FinOverview } from '@fitbay/calc';
import type { PkgReq, Slot, Tip, Trainer } from './trainers';
import { useNav } from '@/nav/store';

/** Снимок клиента у тренера (GET /trainer/clients, shareSnapshot прототипа). */
export interface ClWorkout {
  id: string;
  date: string;
  at: number | null;
  title: string;
  min: number;
  kcal: number;
  tags: string[];
  note: string;
  plan: { week?: number; items: { id: string; sets: number; reps: string; kg?: number }[] } | null;
  items: { id: string | null; name: string; tags: string[]; note: string; sets: { r: number; w: number }[] }[];
}
export interface Client {
  id: string;
  name: string;
  since: number;
  ref: string | null;
  consent: { at: number };
  profile: { sex?: 'm' | 'f'; age?: number; h?: number; w?: number; tw?: number; act?: number; goal?: string } | null;
  targets: { k: number; p: number; f: number; c: number } | null;
  days: (ClDay & { f: number; c: number; n: number })[];
  workouts: ClWorkout[];
  activities: { date: string; name: string; kcal: number; min: number; steps: number | null }[];
  checkins: Checkin[];
  measures: { date: string; weight?: number; waist?: number; chest?: number; hips?: number; biceps?: number }[];
  tips: Tip[];
  ba: { before?: { img: string; date: string; w?: number }; after?: { img: string; date: string; w?: number }; status?: string; note?: string; consent?: { publish: boolean; hideFace: boolean }; sentAt?: number } | null;
  updatedAt: number | null;
}
/** Слот тренера целиком (у клиента видно меньше). */
export interface TSlot extends Slot {
  bookedAt?: number;
  adhoc?: boolean;
  live?: { start: number } | null;
  session?: { title: string; start: number; end: number; items: { id: string; name: string; sets: { r: number; w: number }[]; tags?: string[]; note?: string }[]; tags: string[]; note: string } | null;
  tnote?: { tags: string[]; note: string; at: number; by: string } | null;
}

export const useClients = () => {
  const isTrainer = useNav((s) => s.isTrainer);
  return useQuery({ queryKey: ['clients'], enabled: isTrainer, retry: false, queryFn: () => api.call<{ items: Client[] }>('GET', '/trainer/clients').then((r) => r.items) });
};
export const useMySlots = () => {
  const isTrainer = useNav((s) => s.isTrainer);
  return useQuery({ queryKey: ['myslots'], enabled: isTrainer, retry: false, queryFn: () => api.call<{ items: TSlot[] }>('GET', '/trainer/slots').then((r) => r.items.sort((a, b) => a.start - b.start)) });
};
/** Свой профиль тренера (st.myTrainer прототипа). */
export const useMyTrainer = () => {
  const isTrainer = useNav((s) => s.isTrainer);
  return useQuery({ queryKey: ['my-trainer'], enabled: isTrainer, retry: false, queryFn: () => api.call<Trainer & { partner?: boolean; code?: string }>('GET', '/trainer/profile').catch(() => null) });
};
/** Обзор денег (renderFin прототипа), считается на сервере через calc finOverview. */
export const useFin = () => {
  const isTrainer = useNav((s) => s.isTrainer);
  return useQuery({ queryKey: ['fin'], enabled: isTrainer, retry: false, queryFn: () => api.call<FinOverview>('GET', '/trainer/overview') });
};
export const useTrainerReqs = () => {
  const isTrainer = useNav((s) => s.isTrainer);
  return useQuery({ queryKey: ['trainer-requests'], enabled: isTrainer, retry: false, queryFn: () => api.call<{ items: PkgReq[] }>('GET', '/trainer/requests').then((r) => r.items) });
};

export function useCabOps() {
  const qc = useQueryClient();
  const done = () => Promise.all(['clients', 'myslots', 'trainer-requests', 'notifs', 'my-trainer', 'fin', 'trainers'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  // eslint-disable-next-line react-hooks/rules-of-hooks -- вызывается безусловно и в одном порядке
  const m = <A, R = unknown>(fn: (a: A) => Promise<R>) => useMutation({ mutationFn: fn, onSuccess: done });
  const enc = encodeURIComponent;
  const S = (id: string) => `/trainer/slots/${enc(id)}`;
  return {
    tips: m(({ cid, items }: { cid: string; items: Tip[] }) => api.call('PUT', `/users/${enc(cid)}/tips`, { items })),
    ba: m(({ cid, ba }: { cid: string; ba: Record<string, unknown> }) => api.call('PUT', `/users/${enc(cid)}/before-after`, ba)),
    addSlots: m((b: { start: number; dur: number; n: number; place: 'gym' | 'online'; addr: string }) => api.call('POST', '/trainer/slots', b)),
    adhoc: m((b: { start: number; bookedBy: string; addr: string }) => api.call<{ items: TSlot[] }>('POST', '/trainer/slots', { ...b, dur: 60, place: 'gym' })),
    delSlot: m((id: string) => api.call('DELETE', S(id))),
    cancel: m(({ id, reason }: { id: string; reason: string }) => api.call('POST', `${S(id)}/cancel`, { reason })),
    note: m(({ id, tags, note }: { id: string; tags: string[]; note: string }) => api.call('POST', `${S(id)}/note`, { tags, note })),
    plan: m(({ id, plan }: { id: string; plan: TSlot['plan'] }) => api.call('POST', `${S(id)}/plan`, { plan })),
    live: m(({ id, on }: { id: string; on: boolean }) => api.call('POST', `${S(id)}/live`, { on })),
    answer: m(({ id, ...b }: { id: string; accept: boolean; answer: string; sessions: number }) => api.call('POST', `/trainer/requests/${enc(id)}/answer`, b)),
    adjust: m(({ id, d }: { id: string; d: 1 | -1 }) => api.call('POST', `/trainer/requests/${enc(id)}/adjust`, { d })),
    /** профиль целиком: сервер перезаписывает все поля карточки */
    profile: m((b: Record<string, unknown>) => api.call('PUT', '/trainer/profile', b)),
    session: m(({ id, session }: { id: string; session: Record<string, unknown> }) => api.call('POST', `${S(id)}/session`, { session })),
  };
}
