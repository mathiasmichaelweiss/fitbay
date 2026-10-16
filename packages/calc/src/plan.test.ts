import { describe, expect, it } from 'vitest';
import g from './golden-plan.json';
import {
  phaseTarget,
  phProgress,
  phWeek,
  planTick,
  plDiff,
  progT,
  planSave,
  type GoalPlan,
  type PlanPhase,
} from './plan';
import type { CalcProfile, Phase } from './index';

const day = new Date(g.now).toISOString().slice(0, 10);
const clean = <T>(x: T) => JSON.parse(JSON.stringify(x)) as T;

describe('план целей: эталоны прототипа', () => {
  it('phaseTarget', () =>
    g.targets.forEach((x) =>
      expect(clean(phaseTarget(x.ph as Phase, x.p as unknown as CalcProfile, day))).toEqual(x.v),
    ));
  it('phProgress', () =>
    g.progress.forEach((x) => {
      const r = phProgress(x.P as unknown as GoalPlan, x.w, g.now);
      const v = x.v as { p: number; txt: string };
      expect(r?.p).toBeCloseTo(v.p, 10);
      if (r?.kind === 'weeks') expect(v.txt).toBe(`неделя ${r.a} из ${r.b}`);
      if (r?.kind === 'weight')
        expect(v.txt).toContain(`→ ${String((r.b as number).toFixed(1)).replace('.', ',')}`);
      if (r?.kind === 'none') expect(v.txt).toBe('без срока');
    }));
  it('planTick', () =>
    g.tick.forEach((x) => {
      const up = planTick(x.P as unknown as GoalPlan, x.w, day, g.now);
      expect(clean({ ...x.P, ...(up ?? {}) })).toEqual(x.v);
    }));
  it('phWeek', () => g.week.forEach((x) => expect(phWeek(x.P as GoalPlan, g.now)).toBe(x.v)));
  it('progT', () => g.prog.forEach((x) => expect(progT(x.it as never, x.wk)).toEqual(x.v)));
  it('plDiff', () => g.diff.forEach((x) => expect(plDiff(x.a as never, x.b as never)).toEqual(x.v)));
});

describe('сохранение плана', () => {
  const ph = {
    id: 'a',
    type: 'cut',
    name: 'Сушка',
    pct: -20,
    prot: 2.2,
    end: { kind: 'weeks', val: 8 },
    note: '',
    workouts: [],
    nutrition: { rules: [], menu: [] },
  } as unknown as PlanPhase;
  it('новый план без архива, повторное сохранение без изменений не трогает дату', () => {
    const a = planSave(null, { phases: [ph], current: 0 }, 'Лукас', 84, 1000);
    expect(a.changes).toEqual(['goals', 'train', 'food']);
    expect(a.archive).toEqual([]);
    const b = planSave(a, { phases: [ph], current: 0 }, 'Лукас', 84, 2000);
    expect(b.updatedAt).toBe(1000);
    expect(b.phaseStart).toBe(1000);
  });
  it('изменение уходит в архив', () => {
    const a = planSave(null, { phases: [ph], current: 0 }, 'Лукас', 84, 1000);
    const b = planSave(a, { phases: [{ ...ph, pct: -15 }], current: 0 }, 'Лукас', 83, 2000);
    expect(b.changes).toEqual(['goals']);
    expect(b.archive?.length).toBe(1);
  });
});
