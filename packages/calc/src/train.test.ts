import { describe, expect, it } from 'vitest';
import g from './golden-train.json';
import { EX, GROUPS, AI_EQ, exName, EXM } from '../../shared/src/exercises';
import { aiCandidates, addSet, finishItems, itemsFromProgram, lastSets, libList, newItem, pvf, setsText, toggleDone, toggleTag, woKcal, type WorkoutLike } from './train';

// Эталоны сняты запуском кода прототипа (scripts/golden-train.mjs).
describe('тренировки: эталоны прототипа', () => {
  it.each(g.libList.map((x) => [`${x.grp}/${x.eq}/${x.q}/${x.lang}`, x] as const))('libList %s', (_, x) => {
    const grp = GROUPS.find((y) => y[0] === x.grp)![2];
    const r = libList(EX, grp, x.eq, x.q, (e) => exName(e, x.lang as 'ru'));
    expect(r.length).toBe(x.n);
    expect(r.slice(0, 15).map((e) => e.i)).toEqual(x.first);
  });
  it.each(g.lastSets.map((x) => [x.id, x] as const))('lastSets %s', (_, x) => expect(lastSets(x.workouts as WorkoutLike[], x.id)).toEqual(x.v));
  it.each(g.woKcal.map((x, i) => [i, x] as const))('woKcal #%d', (_, x) => expect(woKcal(x.a, x.b, x.items, x.stored ?? undefined, x.w ?? undefined)).toBe(x.v));
  it.each(g.setsText.map((x, i) => [i, x] as const))('setsText #%d', (_, x) => expect(setsText(x.s)).toBe(x.v));
  it.each(g.pvf.map((x, i) => [i, x] as const))('pvf #%d', (_, x) => {
    const r = pvf(x.w as WorkoutLike, (id) => (EXM[id] ? [EXM[id].n, exName(EXM[id], 'ru')] : []));
    if (x.v === null) return expect(r).toBeNull();
    expect(r!.pct).toBe(x.v.pct);
    expect(r!.week).toBe(x.v.week);
    expect(r!.rows.map((y) => [y.st, y.score])).toEqual(x.v.rows.map((y: { st: string; score: number }) => [y.st, y.score]));
  });
  it.each(g.aiCandidates.map((x) => [`${x.place}/${x.lvl}`, x] as const))('aiCandidates %s', (_, x) => {
    const eq = x.eq.map((k) => AI_EQ.find((y) => y[0] === k)?.[2]).filter(Boolean) as string[];
    expect(aiCandidates(EX, x.place as 'home', x.lvl, eq, x.wish).map((e) => e.i)).toEqual(x.ids);
  });
});

describe('активная тренировка (правила обработчиков прототипа)', () => {
  it('легко и тяжело взаимоисключающие, повторное нажатие снимает', () => {
    expect(toggleTag(['easy', 'pain'], 'hard')).toEqual(['pain', 'hard']);
    expect(toggleTag(['tech'], 'tech')).toEqual([]);
  });
  it('галочка подставляет повторы и вес прошлого раза или цель', () => {
    const it0 = { id: 'x', target: '8-12', sets: [{ r: '', w: '', d: false }, { r: '', w: '', d: false }] };
    expect(toggleDone(it0, 0, [{ r: 10, w: 20, d: true }])).toEqual({ r: '10', w: '20', d: true });
    expect(toggleDone(it0, 1, [{ r: 10, w: 20, d: true }])).toEqual({ r: '8', w: '', d: true });
    expect(toggleDone({ ...it0, sets: [{ r: '5', w: '', d: true }] }, 0, [])).toEqual({ r: '5', w: '', d: false });
  });
  it('новое упражнение, программа, подход, завершение', () => {
    expect(newItem('a', []).sets).toHaveLength(3);
    expect(newItem('a', [{ r: 5, w: 50, d: true }]).sets).toEqual([{ r: '5', w: '50', d: false }]);
    expect(itemsFromProgram([{ id: 'a', sets: 2, reps: '8', w: 40 }])).toEqual([{ id: 'a', target: '8 · 40 кг', sets: [{ r: '', w: '40', d: false }, { r: '', w: '40', d: false }] }]);
    expect(addSet({ id: 'a', target: '', sets: [{ r: '6', w: '10', d: true }] }).sets[1]).toEqual({ r: '6', w: '10', d: false });
    expect(finishItems([{ id: 'a', target: '', note: ' ok ', sets: [{ r: '6', w: '', d: true }, { r: '6', w: '', d: false }] }, { id: 'b', target: '', sets: [{ r: '1', w: '', d: false }] }], (id) => id.toUpperCase())).toEqual([
      { id: 'a', name: 'A', sets: [{ r: 6, w: 0, d: true }], note: 'ok' },
    ]);
  });
});
