// Эталоны для функций тренировок: запускаем НАСТОЯЩИЙ код прототипа на фиксированных данных.
// Запуск: node scripts/golden-train.mjs  ->  packages/calc/src/golden-train.json
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('docs/prototype/kalorii.html', 'utf8');
const src = (head) => {
  const i = html.indexOf(head);
  if (i < 0) throw new Error('not found ' + head);
  let k = html.indexOf('{', i), depth = 0;
  for (; k < html.length; k++) {
    const c = html[k];
    if (c === '"' || c === '`') { const q = c; k++; while (html[k] !== q) { if (html[k] === '\\') k++; k++; } continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (!depth) break; }
  }
  return html.slice(i, k + 1);
};
const line = (head) => { const i = html.indexOf(head); return html.slice(i, html.indexOf('\n', i)); };
const EX = JSON.parse(html.match(/id="exdb">([\s\S]*?)<\/script>/)[1]);
const code = [
  'const EXM={};EX.forEach(e=>EXM[e.i]=e);',
  line('const DICT={').replace(/\n/g, ''),
].join('\n');
// DICT занимает несколько строк: берем до "};"
const dictStart = html.indexOf('const DICT={'), dictEnd = html.indexOf('};', dictStart) + 2;
const preLine = line('const PRE={');
const body = [
  'const EXM={};EX.forEach(e=>EXM[e.i]=e);',
  html.slice(dictStart, dictEnd),
  'const D=k=>DICT[k]?DICT[k][lang==="de"?1:0]:k;',
  preLine,
  line('const GROUPS='),
  line('const EQ=['),
  'const tr={st:{names:{}}};',
  line('const exName=e=>'),
  line('const setsText=s=>'),
  line('const AI_EQ='),
  src('function libList(){'),
  src('function lastSets(id){'),
  src('function woKcal(a,b,items,stored){'),
  src('function pvf(w){'),
  src('function aiCandidates(){'),
].join('\n');
void code;
const run = (setup, expr) =>
  Function('EX', 'env', `let lang=env.lang||"ru";const st=env.st||{prof:{w:80}};const ts2=env.ts2||{};const ai=env.ai||{};const $=id=>({value:env.wish||""});\n${body}\nreturn (${expr});`)(EX, setup);

const workouts = [
  { id: 'w2', date: '2026-10-10', items: [{ id: 'Pushups', sets: [{ r: 12, w: 0, d: true }, { r: 10, w: 0, d: true }] }, { id: 'Plank', sets: [{ r: 60, w: 0, d: true }] }] },
  { id: 'w1', date: '2026-10-08', items: [{ id: 'Pushups', sets: [{ r: 8, w: 0, d: true }, { r: 8, w: 5, d: false }] }, { id: 'Barbell_Deadlift', sets: [{ r: 5, w: 100, d: true }] }] },
];
const out = { libList: [], lastSets: [], woKcal: [], setsText: [], pvf: [], aiCandidates: [] };
for (const [grp, eq, q, lang] of [['all', 'all', '', 'ru'], ['chest', 'all', '', 'ru'], ['back', 'barbell', '', 'ru'], ['all', 'all', 'жим', 'ru'], ['all', 'all', 'curl', 'de'], ['legs', 'dumbbell', 'lunge', 'de'], ['abs', 'body only', '', 'ru']]) {
  const ids = run({ lang, ts2: { grp, eq, q } }, 'libList().map(e=>e.i)');
  out.libList.push({ grp, eq, q, lang, n: ids.length, first: ids.slice(0, 15) });
}
for (const id of ['Pushups', 'Barbell_Deadlift', 'Plank', 'Nope']) out.lastSets.push({ id, workouts, v: run({ ts2: { workouts } }, `lastSets(${JSON.stringify(id)})`) });
const items3 = [{ sets: [{}, {}, {}] }, { sets: [{}, {}] }];
for (const [a, b, items, stored, w] of [[0, 30 * 60000, items3, undefined, 80], [0, 2 * 60000, items3, undefined, 72.5], [0, 200 * 60000, [], undefined, 90], [0, 45 * 60000, items3, 321, 80], [0, 60000, [], undefined, undefined]])
  out.woKcal.push({ a, b, items, stored, w, v: run({ st: { prof: { w } } }, `woKcal(${a},${b},${JSON.stringify(items)},${JSON.stringify(stored)})`) });
for (const s of [[{ r: 10, w: 20, d: true }, { r: 8, d: true }, { r: 5, w: 30, d: false }], [], [{ r: 0, w: 0, d: true }], [{ r: '', w: 2.5, d: true }]])
  out.setsText.push({ s, v: run({}, `setsText(${JSON.stringify(s)})`) });
const plans = [
  { plan: { week: 2, items: [{ id: 'Pushups', sets: 3, reps: '10' }, { id: 'Plank', sets: 2, reps: '60' }] }, items: [{ id: 'Pushups', sets: [{ r: 12 }, { r: 10 }, { r: 10 }] }, { id: 'Plank', sets: [{ r: 30 }] }] },
  { plan: { items: [{ id: 'Barbell_Deadlift', sets: 3, reps: '5', kg: 100 }, { id: 'Pullups', sets: 3, reps: '8-10' }] }, items: [{ name: 'Barbell Deadlift', sets: [{ r: 5, w: 100 }, { r: 5, w: 100 }, { r: 5, w: 110 }] }] },
  { plan: { items: [{ id: 'Pushups', sets: 2, reps: '' }] }, items: [{ id: 'Pushups', sets: [{ r: 3 }, { r: 3 }, { r: 3 }] }] },
  { plan: { items: [] }, items: [] },
  { items: [] },
];
for (const w of plans) out.pvf.push({ w, v: run({}, `pvf(${JSON.stringify(w)})`) });
for (const [place, lvl, eq, wish] of [['gym', 'beginner', ['none'], ''], ['street', 'intermediate', ['none'], ''], ['home', 'expert', ['dumbbell', 'bar'], ''], ['home', 'beginner', ['none'], 'только гиря']]) {
  const ids = run({ ai: { place, lvl, eq }, wish }, 'aiCandidates().map(e=>e.i)');
  out.aiCandidates.push({ place, lvl, eq, wish, n: ids.length, ids });
}
writeFileSync('packages/calc/src/golden-train.json', JSON.stringify(out));
console.log(out.libList.map((x) => x.n), out.woKcal.map((x) => x.v), out.setsText.map((x) => x.v), out.pvf.map((x) => x.v && x.v.pct), out.aiCandidates.map((x) => x.n));
