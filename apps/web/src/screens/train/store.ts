import { create } from 'zustand';
import type { ActiveWorkout, Program, Workout } from '@fitbay/shared';
import { itemsFromProgram, newItem, type WSet } from '@fitbay/calc';
import { saveActiveRemote } from '@/data/hooks';

/**
 * Состояние раздела «Тренировки» (ts2 прототипа): идущая тренировка и открытые листы.
 * Идущая тренировка сохраняется на сервер с задержкой 500 мс (saveActive), редактирование истории не сохраняется.
 */
export type Pick = false | 'wo' | 'prog';
interface TrainState {
  active: ActiveWorkout | null;
  /** тренировка, отложенная на время редактирования записи из истории */
  parked: ActiveWorkout | null;
  loaded: boolean;
  lib: boolean;
  pick: Pick;
  ex: string | null;
  wo: boolean;
  prog: boolean;
  progEmpty: boolean;
  pe: Program | null;
  hist: boolean;
  ai: boolean;
  set: (p: Partial<TrainState>) => void;
  /** изменить идущую тренировку и сохранить */
  edit: (fn: (a: ActiveWorkout) => ActiveWorkout) => void;
  setActive: (a: ActiveWorkout | null) => void;
}

let t: ReturnType<typeof setTimeout> | undefined;
const persist = (a: ActiveWorkout | null) => {
  if (a?.editId) return;
  clearTimeout(t);
  t = setTimeout(() => void saveActiveRemote(a).catch(() => {}), 500);
};

export const useTrain = create<TrainState>((set, get) => ({
  active: null,
  parked: null,
  loaded: false,
  lib: false,
  pick: false,
  ex: null,
  wo: false,
  prog: false,
  progEmpty: false,
  pe: null,
  hist: false,
  ai: false,
  set: (p) => set(p),
  edit: (fn) => {
    const a = get().active;
    if (!a) return;
    const n = fn(a);
    set({ active: n });
    persist(n);
  },
  setActive: (a) => {
    set({ active: a });
    persist(a);
  },
}));

/** startWorkout(prog) прототипа */
export function startWorkout(prog: Program | null, title: string, kg: string, known: (id: string) => boolean) {
  const a: ActiveWorkout = {
    title: prog ? prog.name : title,
    start: Date.now(),
    progId: prog ? prog.id : null,
    ...(prog?.plan ? { plan: prog.plan } : {}),
    items: prog ? itemsFromProgram(prog.items.filter((i) => known(i.id)), kg) : [],
  };
  useTrain.getState().setActive(a);
  useTrain.setState({ wo: true, prog: false, lib: false, ex: null, hist: false, ai: false });
}

/** addToWorkout(id) прототипа: подходы как в прошлый раз */
export function addToWorkout(id: string, title: string, prev: WSet[]) {
  const s = useTrain.getState();
  const a = s.active ?? { title, start: Date.now(), progId: null, items: [] };
  s.setActive({ ...a, items: [...a.items, newItem(id, prev)] });
  useTrain.setState({ lib: false, pick: false, ex: null, wo: true });
}

/** editWorkout(id) прототипа: запись из истории открывается в том же листе */
export function editWorkout(w: Workout, known: (id: string) => boolean) {
  const s = useTrain.getState();
  const parked = s.active && !s.active.editId ? s.active : s.parked;
  useTrain.setState({
    parked,
    hist: false,
    wo: true,
    active: {
      editId: w.id,
      title: w.title,
      start: w.start,
      end: w.end,
      progId: w.progId ?? null,
      tags: w.tags ?? [],
      note: w.note ?? '',
      items: (w.items ?? [])
        .filter((i) => known(i.id))
        .map((i) => ({ id: i.id, target: '', tags: i.tags ?? [], note: i.note ?? '', sets: (i.sets ?? []).map((x) => ({ r: String(x.r), w: x.w ? String(x.w) : '', d: true })) })),
    },
  });
}

/** endEdit() прототипа: вернуть отложенную тренировку */
export function endEdit() {
  const s = useTrain.getState();
  useTrain.setState({ active: s.parked, parked: null, wo: false });
}
