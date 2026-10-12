/**
 * @fitbay/calc: единственный источник правды для всех производных чисел (спека 4.1).
 * Порт CALC из прототипа docs/prototype/kalorii.html (строки ~714-740), один в один по формулам.
 * Отличие только в том, что функции чистые: всё, что прототип брал из глобального st
 * (доля сожжённого, активности дня, фаза плана, тренировки и записи), передаётся аргументами.
 * Эталоны: src/golden.json сняты запуском настоящего CALC прототипа (см. golden.test.ts).
 */

export type Sex = 'm' | 'f';
/** Тренировок в неделю, как в прототипе: 0, 1 (1-2), 3 (3-4), 5 (5-6), 7 (7+). */
export type Activity = 0 | 1 | 3 | 5 | 7;
export type Goal = 'lose' | 'recomp' | 'keep' | 'gain';
export type DayType = 'train' | 'rest';

export const ACTS: { value: Activity; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1–2' },
  { value: 3, label: '3–4' },
  { value: 5, label: '5–6' },
  { value: 7, label: '7+' },
];
export const GOALS: Goal[] = ['lose', 'recomp', 'keep', 'gain'];

export const ACT: Record<number, number> = { 0: 1.2, 1: 1.375, 3: 1.55, 5: 1.725, 7: 1.9 };
export const GOAL_K: Record<Goal, number> = { lose: 0.85, recomp: 0.9, gain: 1.1, keep: 1 };
export const PROT_PER_KG: Record<Goal, number> = { lose: 1.8, recomp: 2.2, keep: 1.6, gain: 2.0 };
export const KCAL_PER_G_FAT = 7.7;
/** Доля сожжённого на тренировках, которая добавляется к норме (по умолчанию 50%). */
export const DEFAULT_ACT_PCT = 0.5;

export interface Macros {
  p: number;
  f: number;
  c: number;
}
export interface Flex {
  on?: boolean;
  /** Дни недели 1..7 (пн = 1), которые считаются тренировочными. */
  days: number[];
  train: Macros;
  rest: Macros;
}
export interface Phase {
  type?: string; // cut, bulk, keep, recomp, custom
  mode?: 'pct' | 'abs' | 'macro' | 'flex';
  pct?: number;
  kcal?: number;
  prot?: number;
  mp?: number; mf?: number; mc?: number;
  tp?: number; tf?: number; tc?: number;
  rp?: number; rf?: number; rc?: number;
  days?: number[];
}
export interface CalcProfile {
  sex: Sex;
  /** Дата рождения YYYY-MM-DD; если нет, используется age. */
  birth?: string;
  age?: number;
  h: number;
  w: number;
  act: Activity;
  goal: Goal;
  tw?: number;
  macro?: Macros & { on?: boolean };
  flex?: Flex;
  /** Ручной тип дня: { '2026-10-12': 'train' }. */
  dayOv?: Record<string, DayType>;
}
export interface DayContext {
  /** Доля сожжённого 0 | 0.5 | 1. */
  pct?: number;
  /** Сожжено за день (тренировки + активности), ккал. */
  actKcal?: number;
  /** Текущая фаза плана тренера, если есть. */
  phase?: Phase | null;
  /** В этот день есть тренировка в журнале или запись к тренеру. */
  hasWorkout?: boolean;
}
export interface Target {
  k: number;
  p: number;
  f: number;
  c: number;
  base: number;
  bonus: number;
  tdee: number;
  bmr: number;
  manual?: boolean;
  dayType?: DayType | null;
}

/** Полных лет на дату (ageOf прототипа). */
export function age(birth: string, on: string): number {
  const [by, bm, bd] = birth.split('-').map(Number) as [number, number, number];
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
const ageAt = (p: CalcProfile, day: string) => (p.birth ? age(p.birth, day) : (p.age ?? 30));

/** Базовый обмен (Миффлин-Сан Жеор), без округления, как в прототипе. */
export function bmr(p: Pick<CalcProfile, 'sex' | 'h' | 'birth' | 'age'>, w: number, day: string): number {
  return 10 * w + 6.25 * p.h - 5 * ageAt(p as CalcProfile, day) + (p.sex === 'm' ? 5 : -161);
}

/** Коэффициент активности. Если бонус за активность включён, коэффициент не выше 1.375 (чтобы не считать тренировки дважды). */
export function factor(p: Pick<CalcProfile, 'act'>, pct = DEFAULT_ACT_PCT): number {
  const f0 = ACT[p.act] ?? 1.2;
  return pct > 0 ? Math.min(f0, 1.375) : f0;
}

/** Бонус к норме за активность дня: доля сожжённого, округлено до 10. */
export function bonus(actKcal: number, pct = DEFAULT_ACT_PCT): number {
  return pct > 0 ? Math.round((actKcal * pct) / 10) * 10 : 0;
}

/** Расход за день. weight: вес на этот день (последнее взвешивание), иначе вес профиля. */
export function expenditure(p: CalcProfile, day: string, ctx: DayContext = {}, weight = p.w): number {
  const pct = ctx.pct ?? DEFAULT_ACT_PCT;
  return bmr(p, weight, day) * factor(p, pct) + (ctx.actKcal ?? 0) * pct;
}

/** Гибкий план: из фазы (mode flex) или из профиля клиента. */
export function flexOf(p: CalcProfile, phase?: Phase | null): Flex | null {
  if (phase) {
    return phase.mode === 'flex'
      ? { days: phase.days ?? [1, 3, 5], train: { p: phase.tp ?? 0, f: phase.tf ?? 0, c: phase.tc ?? 0 }, rest: { p: phase.rp ?? 0, f: phase.rf ?? 0, c: phase.rc ?? 0 } }
      : null;
  }
  return p.flex?.on ? p.flex : null;
}

/** Тип дня: ручной override → тренировка или запись в этот день → день недели из гибкого плана. */
export function dayType(day: string, p: CalcProfile, fx: Flex | null, hasWorkout = false): DayType {
  const ov = p.dayOv?.[day];
  if (ov) return ov;
  if (hasWorkout) return 'train';
  const wd = ((new Date(`${day}T12:00:00`).getDay() + 6) % 7) + 1;
  return fx?.days?.includes(wd) ? 'train' : 'rest';
}

const r10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Норма на день. Приоритет источников (спека 4.1):
 * гибкий план фазы → БЖУ фазы → калории фазы (% или ккал) → ручные БЖУ клиента → гибкий план клиента → авто по цели.
 */
export function target(p: CalcProfile, day: string, ctx: DayContext = {}): Target {
  const pct = ctx.pct ?? DEFAULT_ACT_PCT;
  const ph = ctx.phase ?? null;
  const b = bmr(p, p.w, day);
  const tdee = b * factor(p, pct);
  const fx = flexOf(p, ph);
  const dt = fx ? dayType(day, p, fx, ctx.hasWorkout) : null;
  const bon = bonus(ctx.actKcal ?? 0, pct);

  const M: Macros | null = fx && dt
    ? { p: +fx[dt].p || 0, f: +fx[dt].f || 0, c: +fx[dt].c || 0 }
    : ph
      ? ph.mode === 'macro' ? { p: +(ph.mp ?? 0), f: +(ph.mf ?? 0), c: +(ph.mc ?? 0) } : null
      : p.macro?.on ? { p: +p.macro.p || 0, f: +p.macro.f || 0, c: +p.macro.c || 0 } : null;

  if (M && (M.p || M.f || M.c)) {
    const base = M.p * 4 + M.f * 9 + M.c * 4;
    return { manual: true, dayType: dt, bonus: bon, base: r10(base), k: r10(base + bon), p: Math.round(M.p), f: Math.round(M.f), c: Math.round(M.c + bon / 4), tdee: Math.round(tdee), bmr: Math.round(b) };
  }

  let k = ph ? (ph.mode === 'abs' && +(ph.kcal ?? 0) > 0 ? +(ph.kcal ?? 0) : tdee * (1 + +(ph.pct ?? 0) / 100)) : tdee * (GOAL_K[p.goal] ?? 1);
  const floor = Math.max(b, p.sex === 'm' ? 1500 : 1200);
  if (k < floor) k = floor;
  const base = k;
  k = base + bon;
  const pr = p.w * (ph && +(ph.prot ?? 0) > 0 ? +(ph.prot ?? 0) : (PROT_PER_KG[p.goal] ?? 1.6));
  const fat = p.w * ((ph ? ph.type === 'recomp' : p.goal === 'recomp') ? 0.8 : 0.9);
  const c = Math.max(0, (k - pr * 4 - fat * 9) / 4);
  return { bonus: bon, base: r10(base), k: r10(k), p: Math.round(pr), f: Math.round(fat), c: Math.round(c), tdee: Math.round(tdee), bmr: Math.round(b) };
}

/** Доля мышц в потере веса при дефиците (зависит от белка г/кг). */
export const leanShare = (pk: number) => Math.min(0.35, Math.max(0.1, 0.35 - (pk - 0.8) * 0.2));
/** Сколько граммов жира даёт дефицит (или профицит) в ккал. */
export const fatFromDeficit = (def: number, pk: number) => (def > 0 ? (def / KCAL_PER_G_FAT) * (1 - leanShare(pk)) : def / KCAL_PER_G_FAT);

export interface MacroSum {
  k: number;
  p: number;
  f: number;
  c: number;
}
/** Сумма по приёмам пищи (sums прототипа; поля приёма: kcal, protein, fat, carbs). */
export function sum(items: { kcal?: number; protein?: number; fat?: number; carbs?: number }[]): MacroSum {
  return items.reduce((a, m) => ({ k: a.k + (Number(m.kcal) || 0), p: a.p + (Number(m.protein) || 0), f: a.f + (Number(m.fat) || 0), c: a.c + (Number(m.carbs) || 0) }), { k: 0, p: 0, f: 0, c: 0 });
}

/** Доля выполнения 0..1+ (для колец). Норма 0 даёт 0. */
export const ratio = (eaten: number, goal: number): number => (goal > 0 ? eaten / goal : 0);

/* ---- самочувствие (CI_M, ciAvg, ciBad прототипа) ---- */
export const CI_KEYS = ['sleep', 'energy', 'stress', 'hunger', 'pain', 'adh'] as const;
export type CiKey = (typeof CI_KEYS)[number];
/** Шкала 1..5 у всех пунктов, 5 = хорошо (для стресса, голода и боли 5 = «Нет»). */
export type CheckinValues = Partial<Record<CiKey, number>> & { date: string };

/** Среднее по отмеченным пунктам; 0, если ничего не отмечено. */
export function ciAvg(x: Partial<Record<CiKey, number>>): number {
  const v = CI_KEYS.map((k) => Number(x[k])).filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Сигнал тренеру: 3 последних чек-ина в пределах 4 дней, все со средним ≤ 2.5, последний не старше 2 дней. */
export function ciBad(list: CheckinValues[], today: string): boolean {
  const r = [...list].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-3);
  if (r.length < 3) return false;
  const days = (new Date(`${r[2]!.date}T12:00:00`).getTime() - new Date(`${r[0]!.date}T12:00:00`).getTime()) / 864e5;
  return days <= 4 && r.every((x) => ciAvg(x) <= 2.5) && r[2]!.date >= shiftDay(today, -2);
}

/* ---- пакеты тренера (pkgSessDefault, pkgUsage, priceNum, renderFin прототипа) ---- */
const DAY = 864e5;

export interface PkgCfg {
  freq?: number;
  months?: number;
}
export interface PkgRequest {
  uid: string;
  trainer: string;
  name?: string;
  status: 'new' | 'accepted' | 'declined' | string;
  pkg?: { id?: string; name?: string; price?: string; cfg?: PkgCfg };
  sessions?: { total?: number };
  /** Ручные списания (+) и возвраты (−) тренером. */
  adj?: number;
  at?: number;
  answeredAt?: number;
}
export interface SlotLike {
  trainer: string;
  start: number; // ms
  dur?: number; // мин
  bookedBy?: string | null;
  burned?: { at: number } | null;
}
export interface Usage {
  tot: number;
  used: number;
  left: number;
  pct: number;
}

/** Сколько занятий в пакете по умолчанию: частота × месяцы × 4.33 или число из названия («10 Einheiten»). */
export function pkgSessDefault(r: Pick<PkgRequest, 'pkg'>): number {
  const c = r.pkg?.cfg;
  if (c?.freq) return Math.round(c.freq * (c.months || 1) * 4.33);
  const m = String(r.pkg?.name ?? '').match(/(\d+)\s*(трен|занят|сесс|Train|Einheit|Session|×|x)/i);
  return m ? +m[1]! : 1;
}

/**
 * Счётчик пакета. Занятие считается, если оно прошло (start + dur ≤ now) или сгорело,
 * клиента и тренера этого пакета, не раньше чем за сутки до принятия пакета; плюс ручные списания.
 */
export function pkgUsage(r: PkgRequest, slots: SlotLike[], now: number): Usage | null {
  const tot = +(r.sessions?.total ?? 0) || 0;
  if (r.status !== 'accepted' || !tot) return null;
  const from = r.answeredAt || r.at || 0;
  const done = slots.filter((x) => x.bookedBy === r.uid && x.trainer === r.trainer && x.start >= from - DAY && (x.burned || x.start + (x.dur || 60) * 6e4 <= now)).length;
  const used = Math.max(0, done + (+(r.adj ?? 0) || 0));
  return { tot, used, left: Math.max(0, tot - used), pct: Math.min(1, used / tot) };
}

/** Цена из строки «1 200,50 €» → 1200.5. */
export function priceNum(x: unknown): number {
  const m = String(x ?? '').replace(/\s/g, '').replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? +m[0] : 0;
}

/** Отмена клиентом позже чем за 24 часа: занятие сгорает и списывается из пакета. */
export const isLateCancel = (start: number, now: number) => start - now < DAY;

/** Комиссия FitBay для тренера-одиночки (спека 4.6); партнёр без комиссии. Ступени студий в B5.3. */
export const COMMISSION_SOLO = 0.125;

export interface FinOverview {
  revenue: number; // за текущий месяц
  revenuePrev: number;
  net: number; // за вычетом комиссии
  commission: number;
  months: { m: number; v: number }[]; // 6 месяцев, m = год*12+месяц
  done: number;
  donePrev: number;
  burned: number;
  activeClients: number;
  clients: number;
  prepaid: number; // оплачено, но ещё не проведено
  ending: { r: PkgRequest; u: Usage }[];
  all: { r: PkgRequest; u: Usage }[];
  top: [string, number][];
}

/** Обзор денег тренера (renderFin прототипа). clients: updatedAt клиентов для «активные за 14 дней». */
export function finOverview(reqs: PkgRequest[], slots: SlotLike[], clients: { updatedAt?: number }[], partner: boolean, now: number): FinOverview {
  const mk = (t: number) => {
    const x = new Date(t);
    return x.getFullYear() * 12 + x.getMonth();
  };
  const cur = mk(now);
  const A = reqs.filter((r) => r.status === 'accepted');
  const commission = partner ? 0 : COMMISSION_SOLO;
  const rev = (m: number) => A.filter((r) => mk(r.answeredAt || r.at || 0) === m).reduce((a, r) => a + priceNum(r.pkg?.price), 0);
  const months = Array.from({ length: 6 }, (_, i) => cur - 5 + i).map((m) => ({ m, v: rev(m) }));
  const done = (m: number) => slots.filter((x) => x.bookedBy && mk(x.start) === m && x.start + (x.dur || 60) * 6e4 <= now && !x.burned).length;
  const burned = slots.filter((x) => x.burned && mk(x.start) === cur).length;
  const all = A.map((r) => ({ r, u: pkgUsage(r, slots, now) })).filter((x): x is { r: PkgRequest; u: Usage } => !!x.u);
  const ending = all.filter((x) => x.u.left <= 2).sort((a, b) => a.u.left - b.u.left);
  const by: Record<string, number> = {};
  for (const r of A) by[r.name || '?'] = (by[r.name || '?'] || 0) + priceNum(r.pkg?.price);
  const revenue = rev(cur);
  return {
    revenue,
    revenuePrev: rev(cur - 1),
    net: revenue * (1 - commission),
    commission,
    months,
    done: done(cur),
    donePrev: done(cur - 1),
    burned,
    activeClients: clients.filter((c) => (c.updatedAt || 0) > now - 14 * DAY).length,
    clients: clients.length,
    prepaid: all.reduce((a, x) => a + x.u.left, 0),
    ending,
    all,
    top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

/* ---- поправки веса блюд (wcKey, wcAgg, loadWcAll, запись поправки в saveMeal прототипа) ---- */
export interface WeightCorr {
  /** Название блюда */
  n: string;
  /** Оценка ИИ, г */
  est: number;
  /** На весах, г */
  real: number;
  at: number;
}
export interface CommunityRow {
  r: number;
  u: string;
  at: number;
}

/** Нормализованный ключ блюда для сравнения. */
export const wcKey = (n: unknown) =>
  String(n || '')
    .toLowerCase()
    .replace(/[^a-zа-яёäöüß0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Записать поправку, если вес с весов отличается от оценки ИИ больше чем на 15%.
 * Предыдущая поправка по тому же блюду заменяется, хранятся последние 30. Возвращает новый список или null.
 */
export function addCorrection(list: WeightCorr[], dish: string, est: number, real: number, at: number): WeightCorr[] | null {
  if (!est || !real || Math.abs(real - est) / est <= 0.15) return null;
  return list.filter((x) => x.n !== dish).concat([{ n: dish, est: Math.round(est), real: Math.round(real), at }]).slice(-30);
}

/** Сбор общей базы: последние 30 поправок каждого пользователя, коэффициенты вне 0.15..6 отбрасываются. */
export function communityIndex(docs: Record<string, WeightCorr[]>): Record<string, CommunityRow[]> {
  const by: Record<string, CommunityRow[]> = {};
  for (const [u, list] of Object.entries(docs))
    for (const x of list.slice(-30)) {
      const r = x.real / x.est;
      if (!(r > 0.15 && r < 6)) continue;
      (by[wcKey(x.n)] ??= []).push({ r, u, at: x.at || 0 });
    }
  return by;
}

/** Последние 30 по блюду, медиана, отсев за пределами ×0.5..×2 от медианы, среднее. */
export function wcAgg(rows: CommunityRow[]): { avg: number; n: number; users: number } {
  const L = [...rows].sort((a, b) => b.at - a.at).slice(0, 30);
  const s = L.map((x) => x.r).sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)]!;
  const ok = L.filter((x) => x.r >= med / 2 && x.r <= med * 2);
  return { avg: ok.reduce((a, x) => a + x.r, 0) / ok.length, n: ok.length, users: new Set(ok.map((x) => x.u)).size };
}

/** Поиск по блюду (как wcHint): точное совпадение ключа или вхождение, если оба длиннее 3 символов. */
export function communityFor(index: Record<string, CommunityRow[]>, name: string): { avg: number; n: number; users: number } | null {
  const k = wcKey(name);
  if (!k) return null;
  const L = Object.entries(index)
    .filter(([kk]) => kk === k || (kk.length > 3 && k.length > 3 && (k.includes(kk) || kk.includes(k))))
    .flatMap(([, v]) => v);
  return L.length ? wcAgg(L) : null;
}

/* ---- группировка приёмов пищи (groupMeals прототипа) ---- */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface MealLike {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  slot?: MealSlot;
  desc?: string;
  thumb?: string;
}
export type MealT = MealLike & { ts: number };
export interface MealGroup {
  slot: MealSlot;
  items: MealT[];
  first: number;
  last: number;
  kcal: number;
}

/**
 * groupMeals прототипа: приёмы ближе 20 минут склеиваются; первый кластер дня завтрак,
 * крупные кластеры (≥ max(250, 12% нормы)) обед и ужин, остальное перекусы. Явный slot важнее.
 */
export function groupMeals(list: MealT[], targetK: number): MealGroup[] {
  const ms = [...list].sort((a, b) => a.ts - b.ts);
  const cl: { items: MealT[]; last: number; auto?: MealSlot }[] = [];
  for (const m of ms) {
    const c = cl[cl.length - 1];
    if (c && m.ts - c.last <= 20 * 60000) {
      c.items.push(m);
      c.last = m.ts;
    } else cl.push({ items: [m], last: m.ts });
  }
  const big = Math.max(250, (targetK || 2000) * 0.12);
  let mains = 0;
  for (const c of cl) {
    const k = c.items.reduce((a, m) => a + (+m.kcal || 0), 0);
    if (mains === 0) {
      c.auto = 'breakfast';
      mains++;
    } else if (k >= big && mains < 3) {
      c.auto = (['breakfast', 'lunch', 'dinner'] as const)[mains];
      mains++;
    } else c.auto = 'snack';
  }
  const out: MealGroup[] = [];
  const map: Record<string, MealGroup> = {};
  cl.forEach((c, ci) =>
    c.items.forEach((m) => {
      const sl = m.slot || c.auto!;
      const key = sl === 'snack' ? `snack${m.slot ? 'm' : ci}` : sl;
      let g = map[key];
      if (!g) {
        g = map[key] = { slot: sl, items: [], first: m.ts, last: m.ts, kcal: 0 };
        out.push(g);
      }
      g.items.push(m);
      g.first = Math.min(g.first, m.ts);
      g.last = Math.max(g.last, m.ts);
      g.kcal += +m.kcal || 0;
    }),
  );
  out.forEach((g) => g.items.sort((a, b) => b.ts - a.ts));
  return out.sort((a, b) => b.last - a.last);
}

export const SLOTN: Record<MealSlot, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };


/** Ключ набора еды за день (mealsKey прототипа): совет коуча не перезапрашивается, пока он не изменился. */
export const mealsKey = (ms: { id: string; kcal: number; protein: number }[]) => `v2|${ms.map((m) => `${m.id}:${m.kcal}:${m.protein}`).join('|')}`;

/* ---- жир за день и прогноз (dayStats, proj, CALC.weightOn прототипа) ---- */
export interface Weighing {
  date: string;
  w: number;
}
/** Вес на дату: последнее взвешивание не позже дня, иначе вес профиля. */
export function weightOn(weights: Weighing[], day: string, fallback: number): number {
  let w: number | null = null;
  for (const x of [...weights].sort((a, b) => (a.date < b.date ? -1 : 1))) if (x.date <= day) w = x.w;
  return w || fallback;
}
export interface DayStat {
  d: string;
  eat: number;
  prot: number;
  /** белок г на кг веса */
  pk: number;
  ls: number;
  tdee: number;
  /** дефицит, ккал (минус = профицит) */
  def: number;
  /** жир, г (минус = набор) */
  fat: number;
}

/**
 * dayStats прототипа: по каждому дню с едой расход (с весом на этот день и активностью), дефицит и жир.
 * Выбранный день без еды не учитывается. actKcal: сожжено по дням.
 */
export function dayStats(meals: { date: string; kcal?: number; protein?: number }[], p: CalcProfile, day: string, weights: Weighing[] = [], actKcal: Record<string, number> = {}, pct = DEFAULT_ACT_PCT): DayStat[] {
  const by: Record<string, number> = {}, pr: Record<string, number> = {};
  for (const m of meals) {
    by[m.date] = (by[m.date] || 0) + (Number(m.kcal) || 0);
    pr[m.date] = (pr[m.date] || 0) + (Number(m.protein) || 0);
  }
  if (!by[day]) delete by[day];
  return Object.keys(by)
    .sort()
    .map((d) => {
      const w = weightOn(weights, d, p.w);
      const t = expenditure(p, d, { pct, actKcal: actKcal[d] ?? 0 }, w);
      const def = t - by[d]!;
      const pk = (pr[d] || 0) / w;
      const ls = def > 0 ? leanShare(pk) : 0;
      return { d, eat: by[d]!, prot: pr[d] || 0, pk, ls, tdee: t, def, fat: fatFromDeficit(def, pk) };
    });
}

/** proj прототипа: средний дефицит последних 14 прошедших дней (если их меньше 3, всех), прогноз жира за месяц, кг. */
export function proj(D: DayStat[], today: string): { avg: number; month: number; n: number } | null {
  const L = D.filter((x) => x.d < today).slice(-14);
  const use = L.length >= 3 ? L : D.slice(-14);
  if (!use.length) return null;
  const avg = use.reduce((a, x) => a + x.def, 0) / use.length;
  return { avg, month: (avg * 30) / 7700, n: use.length };
}

/** Срок до целевого веса в спокойном темпе (eta прототипа): недели, «цель не в ту сторону» или null. */
export function eta(p: Pick<CalcProfile, 'w' | 'tw' | 'goal'>): { weeks: number } | { wrong: true } | null {
  const d = Math.abs(p.w - (p.tw || p.w));
  if (p.goal === 'keep' || d < 0.1) return null;
  const rate = p.w * ({ lose: 0.0075, recomp: 0.004, gain: 0.0025 } as Record<string, number>)[p.goal]!;
  if ((p.goal === 'gain') !== ((p.tw ?? p.w) > p.w)) return { wrong: true };
  return { weeks: Math.ceil(d / rate) };
}
export * from './train';
export * from './weight';
export * from './pkgprice';
export * from './clients';
