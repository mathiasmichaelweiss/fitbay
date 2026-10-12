// Эталоны WEIGHT.analyze прототипа («Почему вес изменился?»): код берется из прототипа как есть.
// Запуск: node scripts/golden-weight.mjs -> packages/calc/src/golden-weight.json
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('docs/prototype/kalorii.html', 'utf8');
const i = html.indexOf('const WEIGHT={'), j = html.indexOf('  text(r){', i);
const analyze = html.slice(i, j).replace(/,\s*$/, '') + '};';
const line = (h) => { const k = html.indexOf(h); return html.slice(k, html.indexOf('\n', k)); };
const kp = line('KCAL_PER_G_FAT');
const run = (env) => Function('env', `
  const CALC={KCAL_PER_G_FAT:${kp.match(/KCAL_PER_G_FAT\s*:\s*([\d.]+)/)[1]},${line('  leanShare(pk)').trim()}${line('  fatFromDeficit(def,pk)').trim()}};
  const iso=()=>env.today;const shiftIso=(d,n)=>{const x=new Date(d+"T12:00");x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
  const dayStats=()=>env.D;const tr2={meals:env.meals.map(d=>({date:d}))};const ts2={workouts:env.wos.map(d=>({date:d}))};
  ${analyze}
  return WEIGHT.analyze(env.prev,env.newW,env.newDate);`)(env);
const D = (from, n, defs, pks) => Array.from({ length: n }, (_, k) => { const d = new Date(from + 'T12:00'); d.setDate(d.getDate() + k); return { d: d.toISOString().slice(0, 10), def: defs[k % defs.length], pk: pks[k % pks.length] }; });
const cases = [
  { name: 'plan', D: D('2026-09-01', 7, [500], [1.8]), prev: { w: 84, date: '2026-09-01' }, newW: 83.6, newDate: '2026-09-08', meals: ['2026-08-01'], wos: [] },
  { name: 'water_start', D: D('2026-10-01', 5, [600], [1.2]), prev: { w: 85, date: '2026-10-01', start: true }, newW: 83.2, newDate: '2026-10-06', meals: ['2026-10-01'], wos: [] },
  { name: 'water_loss', D: D('2026-09-01', 7, [300], [2]), prev: { w: 84, date: '2026-09-01' }, newW: 82.9, newDate: '2026-09-08', meals: ['2026-07-01'], wos: [] },
  { name: 'water_gain', D: D('2026-09-01', 4, [400], [1.4]), prev: { w: 84, date: '2026-09-01' }, newW: 84.9, newDate: '2026-09-05', meals: ['2026-07-01'], wos: [] },
  { name: 'surplus_train', D: D('2026-09-01', 14, [-500, -300], [2]), prev: { w: 80, date: '2026-09-01' }, newW: 81.6, newDate: '2026-09-15', meals: ['2026-07-01'], wos: ['2026-09-02', '2026-09-05', '2026-09-09'] },
  { name: 'surplus', D: D('2026-09-01', 10, [-600], [1]), prev: { w: 80, date: '2026-09-01' }, newW: 81.5, newDate: '2026-09-11', meals: ['2026-07-01'], wos: [] },
  { name: 'water_loss2', D: D('2026-09-01', 6, [-200], [1.5]), prev: { w: 80, date: '2026-09-01' }, newW: 79.2, newDate: '2026-09-07', meals: ['2026-07-01'], wos: [] },
  { name: 'gaps', D: D('2026-09-03', 3, [700], [0.7]), prev: { w: 90, date: '2026-09-01' }, newW: 89.1, newDate: '2026-09-10', meals: ['2026-08-20'], wos: ['2026-09-04'] },
];
const out = cases.map((c) => ({ ...c, today: c.newDate, v: run({ ...c, today: c.newDate }) }));
writeFileSync('packages/calc/src/golden-weight.json', JSON.stringify(out));
console.log(out.map((c) => [c.name, c.v.kind, +c.v.water.toFixed(3)]));
