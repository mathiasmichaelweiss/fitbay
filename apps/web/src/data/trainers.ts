import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GenCfg, Usage } from '@fitbay/calc';
import { api } from './api';

/** Карточка тренера в каталоге (st.trainers прототипа). */
export interface Trainer {
  id: string;
  name: string;
  spec?: string;
  bio?: string;
  about?: string;
  city?: string;
  level?: string;
  price?: string;
  exp?: number;
  sex?: 'm' | 'f' | '';
  edu?: string[];
  online?: boolean;
  formats?: string[];
  tags?: string[];
  color?: string;
  gym?: string;
  packages?: { id: string; name: string; price?: string; desc?: string }[];
  rates?: { on?: number; gym?: number; food?: number; dur?: Record<number, number>; vol?: { min: number; pct: number }[] };
}
export interface Slot {
  id: string;
  trainer: string;
  start: number;
  dur?: number;
  place?: 'gym' | 'online';
  addr?: string;
  bookedBy?: string | null;
  bookedName?: string | null;
  burned?: { at: number; reason?: string } | null;
  cancel?: { by: 'client' | 'trainer'; at: number; reason?: string } | null;
  plan?: { name?: string; note?: string; items?: { id: string; sets?: number; reps?: string; name?: string }[] } | null;
}
export interface PkgReq {
  id: string;
  trainer: string;
  uid: string;
  name?: string;
  pkg: { id: string; name: string; price?: string; cfg?: GenCfg };
  msg?: string;
  contact?: string;
  status: 'new' | 'accepted' | 'declined';
  answer?: string;
  at: number;
  answeredAt?: number;
  sessions?: { total: number };
  adj?: number;
  log?: { d: number; at: number; by?: string }[];
  usage?: Usage | null;
}
export interface Notif {
  id: string;
  type: 'cancel' | 'burned' | 'booked' | 'request' | 'req_accepted' | 'req_declined' | 'sess_charged' | 'sess_returned';
  at: number;
  read?: boolean;
  by?: 'client' | 'trainer';
  trainer?: string;
  client?: string;
  name?: string;
  start?: number;
  reason?: string;
  req?: string;
  sessions?: number;
  d?: number;
}
export interface Tip {
  id: string;
  text: string;
  cat?: 'food' | 'train';
  ts: number;
  from?: string;
  done?: boolean;
  doneAt?: number | null;
}

const items = <T>(p: Promise<{ items: T[] }>) => p.then((r) => r.items);

export const useTrainers = () => useQuery({ queryKey: ['trainers'], queryFn: () => items(api.call<{ items: Trainer[] }>('GET', '/trainers')), retry: false });
export const useTrainer = (tid: string | null) =>
  useQuery({ queryKey: ['trainer', tid], enabled: !!tid, queryFn: () => api.call<Trainer>('GET', `/trainers/${encodeURIComponent(tid!)}`), retry: false });
export const useTrainerSlots = (tid: string | null) =>
  useQuery({ queryKey: ['slots', tid], enabled: !!tid, queryFn: () => items(api.call<{ items: Slot[] }>('GET', `/trainers/${encodeURIComponent(tid!)}/slots`)) });
export const useMyBookings = () =>
  useQuery({ queryKey: ['bookings'], queryFn: () => api.call<{ items: Slot[]; cancelled: Slot[] }>('GET', '/me/bookings'), retry: false });
export const useMyRequests = () => useQuery({ queryKey: ['requests'], queryFn: () => items(api.call<{ items: PkgReq[] }>('GET', '/me/requests')), retry: false });
export const useMyLinks = () =>
  useQuery({ queryKey: ['links'], queryFn: () => items(api.call<{ items: { trainer: string; consent: boolean; since: number }[] }>('GET', '/me/links')), retry: false });
export const useNotifications = () =>
  useQuery({ queryKey: ['notifs'], queryFn: () => items(api.call<{ items: Notif[] }>('GET', '/me/notifications')), retry: false, refetchInterval: 60000 });
export const useTips = () => useQuery({ queryKey: ['tips'], queryFn: () => api.getOne<{ items: Tip[] }>('tips').catch(() => null), retry: false });

/** Все изменения записи и заявок обновляют связанные списки. */
export function useTrainerOps() {
  const qc = useQueryClient();
  const done = () => Promise.all(['slots', 'bookings', 'requests', 'links', 'notifs', 'tips'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const m = <A,>(fn: (a: A) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: done });
  const enc = encodeURIComponent;
  return {
    book: m(({ tid, id, name }: { tid: string; id: string; name: string }) => api.call('POST', `/trainers/${enc(tid)}/slots/${enc(id)}/book`, { name })),
    cancel: m(({ tid, id, reason }: { tid: string; id: string; reason: string }) => api.call<{ late: boolean }>('POST', `/trainers/${enc(tid)}/slots/${enc(id)}/cancel`, { reason })),
    request: m(({ tid, ...b }: { tid: string; name: string; pkg: PkgReq['pkg']; msg: string; contact: string }) => api.call('POST', `/trainers/${enc(tid)}/requests`, b)),
    withdraw: m(({ tid, id }: { tid: string; id: string }) => api.call('DELETE', `/trainers/${enc(tid)}/requests/${enc(id)}`)),
    link: m(({ tid, name, ref }: { tid: string; name: string; ref?: string }) => api.call('PUT', `/trainers/${enc(tid)}/link`, { consent: true, name, ref })),
    unlink: m(({ tid }: { tid: string }) => api.call('DELETE', `/trainers/${enc(tid)}/link`)),
    tips: m((items: Tip[]) => api.putOne('tips', { items })),
    readAll: m(() => api.call('POST', '/me/notifications/read')),
  };
}

/** Имя для записи (myName прототипа): последнее введенное или имя из связи с тренером. */
export const myName = () => {
  try {
    return localStorage.getItem('bkName') ?? '';
  } catch {
    return '';
  }
};
export const saveName = (n: string) => {
  try {
    localStorage.setItem('bkName', n);
  } catch {
    /* нет хранилища */
  }
};
