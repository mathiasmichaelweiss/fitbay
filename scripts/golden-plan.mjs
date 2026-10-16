// Эталоны плана целей: phaseTarget, phProgress, planTick, phWeek, progT, plDiff и сохранение плана прототипа. node scripts/golden-plan.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('docs/prototype/kalorii.html', 'utf8');
const block = (start, end) => { const i = html.indexOf(start); if (i < 0) throw new Error(start); return html.slice(i, html.indexOf(end, i)); };
const line = (h) => { const k = html.indexOf(h); return html.slice(k, html.indexOf('\n', k)); };
const NOW = Date.parse('2026-10-16T10:00:00Z');
const code = [
  block('function ageOf(b,at)', '\n'),
  block('const CALC={', '\nfunction actKcalDay'),
  block('const PH_TYPES={', '\nfunction phaseArt'),
  line('function phOf(P,i)'),
  block('function phProgress(P)', '\nfunction renderPlanTile'),
  line('function phWeek()'),
  line('function progT(it,wk)'),
  block('function plDiff(a,b)', 'return ch}') + 'return ch}',
].join('\n');
const mk = () => Function('NOW', `
  const T=s=>s; const fmtD=t=>new Date(t).toISOString().slice(0,10); const iso=()=>new Date(NOW).toISOString().slice(0,10);
  Date.now=()=>NOW; const st={prof:null,plan:null}; const DB={shared:()=>({doc:()=>({update(){}})})};
  ${code}; return {st,CALC,phProgress,planTick,phWeek,progT,plDiff};`)(NOW);
const f = mk();
const prof = { sex: 'm', birth: '1990-03-14', h: 181, w: 84, tw: 80, act: 3, goal: 'lose' };
const profF = { sex: 'f', age: 28, h: 165, w: 55, act: 0, goal: 'keep' };
const phases = [
  { type: 'cut', mode: 'pct', pct: -20, prot: 2.2 },
  { type: 'bulk', mode: 'pct', pct: 10, prot: 2.0 },
  { type: 'maint', mode: 'abs', kcal: 2400, prot: 1.8 },
  { type: 'cut', mode: 'abs', kcal: 900, prot: 2 },
  { type: 'recomp', mode: 'macro', mp: 180, mf: 70, mc: 220 },
  { type: 'custom', mode: 'flex', tp: 170, tf: 70, tc: 280, rp: 170, rf: 80, rc: 150, days: [1, 3, 5] },
];
const out = { now: NOW, targets: [], progress: [], tick: [], week: [], prog: [], diff: [] };
for (const p of [prof, profF]) for (const ph of phases) out.targets.push({ p, ph, v: f.CALC.phaseTarget(ph, p) });
const W = 7 * 864e5;
const plans = [
  { phases: [{ end: { kind: 'weeks', val: 8 } }, { end: { kind: 'none' } }], current: 0, phaseStart: NOW - 3.5 * W },
  { phases: [{ end: { kind: 'weeks', val: 8 } }, { end: { kind: 'none' } }], current: 0, phaseStart: NOW - 9 * W },
  { phases: [{ end: { kind: 'weight', val: 80 } }, {}], current: 0, phaseStart: NOW - W, startW: 88 },
  { phases: [{ end: { kind: 'weight', val: 90 } }, {}], current: 0, phaseStart: NOW - W, startW: 80 },
  { phases: [{ end: { kind: 'date', val: '2026-12-01' } }, {}], current: 0, phaseStart: NOW - 2 * W },
  { phases: [{ end: { kind: 'date', val: '2026-10-10' } }, {}], current: 0, phaseStart: NOW - 2 * W, history: [{ from: 0, to: 0, at: 1 }] },
  { phases: [{}, { end: { kind: 'none' } }], current: 1, updatedAt: NOW - W },
];
for (const w of [84, 79.5, 91])
  for (const P of plans) {
    f.st.prof = { w }; f.st.plan = JSON.parse(JSON.stringify(P));
    out.progress.push({ P, w, v: f.phProgress(P) });
    f.planTick(); out.tick.push({ P, w, v: f.st.plan });
    out.week.push({ P, v: (f.st.plan = P, f.phWeek()) });
  }
for (const it of [{ reps: '10', sets: 3 }, { reps: '8', kg: 60, pg: 'kg', st: 2.5 }, { reps: '8-10', kg: 20, pg: 'rep', st: 1 }, { reps: '12', pg: 'rep', st: 0.5 }, { reps: '5', kg: '', pg: 'kg', st: 5 }])
  for (const wk of [1, 2, 5]) out.prog.push({ it, wk, v: f.progT(it, wk) });
const A = { phases: [{ type: 'cut', name: 'Сушка', pct: -20, prot: 2.2, end: { kind: 'weeks', val: 8 }, note: '', workouts: [], nutrition: { rules: [], menu: [] } }], current: 0 };
const B1 = JSON.parse(JSON.stringify(A)); B1.phases[0].workouts = [{ name: 'A', items: [] }];
const B2 = JSON.parse(JSON.stringify(A)); B2.phases[0].nutrition.rules = ['x'];
const B3 = JSON.parse(JSON.stringify(A)); B3.current = 1;
for (const [a, b] of [[{}, A], [A, A], [A, B1], [A, B2], [A, B3], [B1, B2]]) out.diff.push({ a, b, v: f.plDiff(a, b) });
writeFileSync('packages/calc/src/golden-plan.json', JSON.stringify(out));
console.log(out.targets.map((x) => x.v.k), out.tick.map((x) => x.v.current), out.prog.map((x) => x.v), out.diff.map((x) => x.v));
