/**
 * План целей от тренера (A4.3): PH_TYPES, PH_TPL, phNew, phaseTarget, phProgress, planTick, phWeek, progT, plDiff прототипа.
 * Эталоны: golden-plan.json (scripts/golden-plan.mjs запускает код прототипа).
 * Тексты (n, d) это ключи перевода.
 */
import { ACT, bmr, type CalcProfile, type Phase } from './index';

export type PhType = 'cut' | 'bulk' | 'maint' | 'recomp' | 'custom';
export const PH_TYPES: Record<
  PhType,
  { n: string; pct: number; prot: number; c1: string; c2: string; d: string }
> = {
  cut: {
    n: 'Сушка',
    pct: -20,
    prot: 2.2,
    c1: '#FF5A0A',
    c2: '#3a1a0a',
    d: 'Небольшой дефицит калорий и много белка. Уходит жир, мышцы сохраняются. Нормальный темп: минус 0,3-0,7 кг в неделю.',
  },
  bulk: {
    n: 'Набор',
    pct: 10,
    prot: 2.0,
    c1: '#AFD9DA',
    c2: '#12302f',
    d: 'Небольшой профицит и силовые с прогрессией. Растут мышцы и сила. Плюс 0,2-0,4 кг в неделю это нормально и нужно.',
  },
  maint: {
    n: 'Удержание',
    pct: 0,
    prot: 1.8,
    c1: '#F2B705',
    c2: '#3a2f08',
    d: 'Едим по расходу. Закрепляем результат, тело привыкает к новому весу, тренировки держим.',
  },
  recomp: {
    n: 'Рекомпозиция',
    pct: -5,
    prot: 2.2,
    c1: '#C9A7EB',
    c2: '#2a1f3a',
    d: 'Калории около расхода, много белка и силовые. Жир уходит, мышцы растут, вес почти не меняется. Главная метрика: талия.',
  },
  custom: {
    n: 'Своя фаза',
    pct: 0,
    prot: 2.0,
    c1: '#9a9a9a',
    c2: '#262626',
    d: 'Индивидуальная фаза от тренера.',
  },
};
export const phTy = (t?: string) => PH_TYPES[(t as PhType) in PH_TYPES ? (t as PhType) : 'custom'];

/** Базовые шаблоны (PH_TPL). */
export const PH_TPL: [string, PhType[]][] = [
  ['Сушка → набор', ['cut', 'bulk', 'maint']],
  ['Рекомпозиция', ['recomp', 'maint']],
  ['Похудение', ['cut', 'maint']],
  ['Набор массы', ['bulk', 'maint']],
];

export interface PhEnd {
  kind: 'weeks' | 'weight' | 'date' | 'none';
  val: number | string | '';
}
export interface PhWorkoutItem {
  id: string;
  sets: number;
  reps: string;
  kg?: number | null;
  /** прогрессия: kg (+ кг в неделю) или rep (+ повторы в неделю) */
  pg?: '' | 'kg' | 'rep';
  st?: number;
}
export interface PhWorkout {
  name: string;
  items: PhWorkoutItem[];
}
export interface PlanPhase extends Phase {
  id: string;
  type: PhType;
  name: string;
  end: PhEnd;
  note: string;
  workouts: PhWorkout[];
  nutrition: { rules: string[]; menu: string[] };
}
export interface GoalPlan {
  id: string;
  phases: PlanPhase[] | null;
  current: number;
  by: string;
  updatedAt: number;
  phaseStart?: number;
  startW?: number | null;
  history?: { from: number; to: number; at: number }[];
  archive?: { phases: PlanPhase[]; by: string; current: number; archivedAt: number }[];
  changes?: ('goals' | 'train' | 'food')[];
}

/** phNew(type): name уже переведено вызывающим (tr). */
export function phNew(
  type: PhType,
  tr: (s: string) => string = (s) => s,
  id = `ph${Math.random().toString(36).slice(2, 8)}`,
): PlanPhase {
  const t = PH_TYPES[type];
  return {
    id,
    type,
    name: tr(t.n),
    mode: 'pct',
    pct: t.pct,
    kcal: '' as unknown as number,
    prot: t.prot,
    end: { kind: type === 'maint' ? 'none' : 'weeks', val: type === 'cut' ? 8 : type === 'bulk' ? 12 : '' },
    note: '',
    workouts: [],
    nutrition: { rules: [], menu: [] },
  };
}

/** Текущая фаза плана (CALC.phase). */
export function curPhase(P: Pick<GoalPlan, 'phases' | 'current'> | null | undefined): PlanPhase | null {
  if (!P?.phases?.length) return null;
  return P.phases[Math.min(P.current || 0, P.phases.length - 1)] ?? null;
}

/** CALC.phaseTarget: норма фазы для маршрута (без бонуса активности). */
export function phaseTarget(
  ph: Phase,
  p: CalcProfile,
  day: string,
): { k: number; k2?: number; p: number; f?: number; c?: number; manual?: boolean; flex?: boolean } {
  const n = (x: unknown) => +(x as number) || 0;
  if (ph.mode === 'flex') {
    const k = (a: unknown, b: unknown, c: unknown) => Math.round((n(a) * 4 + n(b) * 9 + n(c) * 4) / 10) * 10;
    return {
      k: k(ph.tp, ph.tf, ph.tc),
      k2: k(ph.rp, ph.rf, ph.rc),
      p: Math.round(n(ph.tp)),
      f: n(ph.tf),
      c: n(ph.tc),
      manual: true,
      flex: true,
    };
  }
  if (ph.mode === 'macro' && (n(ph.mp) || n(ph.mf) || n(ph.mc)))
    return {
      k: Math.round((n(ph.mp) * 4 + n(ph.mf) * 9 + n(ph.mc) * 4) / 10) * 10,
      p: Math.round(n(ph.mp)),
      f: n(ph.mf),
      c: n(ph.mc),
      manual: true,
    };
  const b = bmr(p, p.w, day);
  const tdee = b * (ACT[p.act] || 1.2);
  let k = ph.mode === 'abs' && n(ph.kcal) > 0 ? n(ph.kcal) : tdee * (1 + n(ph.pct) / 100);
  k = Math.max(k, b, p.sex === 'm' ? 1500 : 1200);
  return { k: Math.round(k / 10) * 10, p: Math.round(p.w * (n(ph.prot) || 1.6)) };
}

/** phProgress: доля фазы и данные для подписи. kind: weeks (a из b), weight (a → b кг), date (до b), none. */
export function phProgress(
  P: GoalPlan,
  w: number,
  now: number,
): { p: number; kind: PhEnd['kind']; a?: number; b?: number | string } | null {
  const ph = curPhase(P);
  if (!ph) return null;
  const e = ph.end || { kind: 'none', val: '' };
  const st0 = P.phaseStart || P.updatedAt || now;
  if (e.kind === 'weeks' && +e.val > 0) {
    const wk = (now - st0) / 6048e5;
    return { p: Math.min(1, wk / +e.val), kind: 'weeks', a: Math.min(+e.val, Math.floor(wk) + 1), b: +e.val };
  }
  if (e.kind === 'weight' && +e.val > 0) {
    const s0 = +(P.startW ?? 0) || w;
    const tot = +e.val - s0,
      done = w - s0;
    return { p: tot ? Math.max(0, Math.min(1, done / tot)) : 1, kind: 'weight', a: w, b: +e.val };
  }
  if (e.kind === 'date' && e.val) {
    const end = new Date(`${e.val}T12:00`).getTime();
    return {
      p: Math.max(0, Math.min(1, (now - st0) / Math.max(1, end - st0))),
      kind: 'date',
      b: String(e.val),
    };
  }
  return { p: 0, kind: 'none' };
}

/** planTick: если условие текущей фазы выполнено, вернуть обновление плана (переход на следующую фазу). */
export function planTick(
  P: GoalPlan,
  w: number,
  today: string,
  now: number,
): Pick<GoalPlan, 'current' | 'phaseStart' | 'startW' | 'history'> | null {
  if (!P?.phases) return null;
  const i = P.current || 0,
    ph = P.phases[i];
  if (!ph || i >= P.phases.length - 1) return null;
  const e = ph.end || { kind: 'none', val: '' };
  let done = false;
  if (e.kind === 'weeks' && +e.val > 0) done = now - (P.phaseStart || 0) >= +e.val * 6048e5;
  if (e.kind === 'date' && e.val) done = today >= String(e.val);
  if (e.kind === 'weight' && +e.val > 0) {
    const s0 = +(P.startW ?? 0) || w;
    done = (+e.val < s0 && w <= +e.val) || (+e.val > s0 && w >= +e.val);
  }
  if (!done) return null;
  return {
    current: i + 1,
    phaseStart: now,
    startW: w,
    history: [...(P.history || []), { from: i, to: i + 1, at: now }],
  };
}

/** phWeek: неделя текущей фазы, с 1. */
export const phWeek = (P: Pick<GoalPlan, 'phaseStart'> | null | undefined, now: number) =>
  P?.phaseStart ? Math.max(1, Math.floor((now - P.phaseStart) / (7 * 864e5)) + 1) : 1;

/** progT: подходы с прогрессией на неделю wk. */
export function progT(it: PhWorkoutItem, wk: number): { kg: number | null; reps: string } {
  const base = parseInt(String(it.reps)) || 0,
    n = wk - 1;
  const kg =
    it.kg != null && (it.kg as unknown) !== ''
      ? +it.kg + (it.pg === 'kg' ? (+(it.st ?? 0) || 0) * n : 0)
      : null;
  const r = it.pg === 'rep' && base ? base + Math.round((+(it.st ?? 0) || 0) * n) : null;
  return { kg, reps: r != null ? String(r) : it.reps };
}

/** plDiff: что изменилось в плане (для колокольчика и архива). */
export function plDiff(a: Partial<GoalPlan>, b: Partial<GoalPlan>): ('goals' | 'train' | 'food')[] {
  const A = a.phases || [],
    B = b.phases || [],
    J = JSON.stringify,
    ch: ('goals' | 'train' | 'food')[] = [];
  const g = (x: PlanPhase[]) =>
    x.map((p) => ({ type: p.type, name: p.name, pct: p.pct, prot: p.prot, end: p.end, note: p.note }));
  if (!a.phases || J(g(A)) !== J(g(B)) || (a.current || 0) !== (b.current || 0)) ch.push('goals');
  if (J(A.map((p) => p.workouts || [])) !== J(B.map((p) => p.workouts || []))) ch.push('train');
  if (J(A.map((p) => p.nutrition || null)) !== J(B.map((p) => p.nutrition || null))) ch.push('food');
  return ch;
}

/** Сохранение плана тренером (обработчик plSave2): новый документ плана с архивом старого. */
export function planSave(
  prev: Partial<GoalPlan> | null,
  draft: { phases: PlanPhase[]; current: number; curChanged?: boolean },
  by: string,
  clientW: number | null,
  now: number,
): GoalPlan {
  const pv = prev || {};
  const changedCur = !prev || pv.current !== draft.current || !!draft.curChanged;
  const data: GoalPlan = {
    id: pv.id || `pl${now}`,
    phases: draft.phases.map((x) => ({ ...x })),
    current: draft.current || 0,
    by,
    updatedAt: now,
    phaseStart: changedCur ? now : pv.phaseStart || now,
    startW: changedCur ? clientW || null : pv.startW || clientW || null,
    history: pv.history || [],
    archive: pv.archive || [],
  };
  data.changes = plDiff(pv, data);
  if (pv.phases?.length && data.changes.length)
    data.archive = [
      ...(pv.archive || []),
      { phases: pv.phases, by: pv.by || '', current: pv.current || 0, archivedAt: now },
    ].slice(-10);
  if (!data.changes.length && pv.updatedAt) {
    data.updatedAt = pv.updatedAt;
    data.changes = pv.changes || [];
  }
  return data;
}

/** Удаление плана тренером (plDel2): фазы убираются, старый план уходит в архив. null: удалить документ целиком. */
export function planRemove(prev: Partial<GoalPlan> | null, now: number): GoalPlan | null {
  const pv = prev || {};
  if (!pv.phases?.length) return null;
  return {
    id: pv.id || '',
    phases: null,
    current: 0,
    by: pv.by || '',
    updatedAt: now,
    changes: [],
    archive: [
      ...(pv.archive || []),
      { phases: pv.phases, by: pv.by || '', current: pv.current || 0, archivedAt: now },
    ].slice(-10),
  };
}
