// Эталоны карточки клиента у тренера: clStats, clPatterns, mealFlag прототипа. node scripts/golden-clients.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('docs/prototype/kalorii.html', 'utf8');
const block = (start, end) => { const i = html.indexOf(start); return html.slice(i, html.indexOf(end, i)); };
const line = (h) => { const k = html.indexOf(h); return html.slice(k, html.indexOf('\n', k)); };
const code = [
  block('function clStats(c){', 'const GOALN='),
  line('const GOALN='),
  block('function clDays(c,n)', 'const LV={'),
  block('function mealFlag(i,t){', 'const flagIc='),
].join('\n');
const make = (lang, today) => Function('lang', 'TODAY', `
  const T=s=>s; const iso=()=>TODAY; const shiftIso=(d,n)=>{const x=new Date(d+"T12:00");x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
  ${code}; return {clStats, clPatterns, mealFlag};`)(lang, today);
const TODAY = '2026-10-12';
const day = (i) => { const d = new Date(TODAY + 'T12:00'); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); };
const ts = (d, h) => new Date(`${d}T${String(h).padStart(2, '0')}:15:00`).getTime();
const mk = (name, profile, targets, dayFn, wos, ms) => ({
  name, profile, targets,
  days: [...Array(14)].map((_, i) => 13 - i).filter((i) => dayFn(i)).map((i) => { const d = day(i); const x = dayFn(i); return { d, k: x.k, p: x.p, f: 70, c: 200, n: x.items.length, items: x.items.map(([nm, k, p, h, slot]) => ({ name: nm, kcal: k, p, slot, ts: ts(d, h) })) }; }),
  workouts: wos.map((i) => ({ date: day(i), title: 'W', min: 50 })), measures: ms,
});
const clients = [
  mk('good', { goal: 'lose', act: 3, w: 80, tw: 75 }, { k: 2000, p: 160 }, () => ({ k: 1980, p: 165, items: [['Омлет', 450, 30, 8, 'breakfast'], ['Курица с рисом', 800, 60, 13, 'lunch'], ['Рыба', 730, 75, 19, 'dinner']] }), [1, 3, 5, 8, 10, 12], [{ date: day(13), weight: 81 }, { date: day(0), weight: 80 }]),
  mk('bad', { goal: 'lose', act: 4, w: 90, tw: 80 }, { k: 2100, p: 170 }, (i) => (i % 5 === 0 ? null : { k: [0, 6].includes(new Date(day(i) + 'T12:00').getDay()) ? 3200 : 1900, p: 90, items: [['Чипсы', 600, 6, 22, 'snack'], ['Пицца', 1100, 40, 14, 'lunch'], ['Пиво', 400, 2, 23, 'snack']] }), [2], [{ date: day(13), w: 90 }, { date: day(0), w: 91.5 }]),
  mk('empty', { goal: 'keep', act: 3 }, { k: 2200, p: 140 }, () => null, [], []),
  mk('gain', { goal: 'gain', act: 2, w: 70 }, { k: 2800, p: 140 }, (i) => (i < 9 ? { k: 2600 + i * 40, p: 150, items: [['Каша', 600, 20, 12, 'breakfast'], ['Мясо', 900, 70, 15, 'lunch']] } : null), [1, 4, 7, 10, 13], [{ date: day(12), weight: 70 }, { date: day(1), weight: 70.8 }]),
];
const out = { today: TODAY, ru: [], de: [], flags: [] };
for (const lang of ['ru', 'de']) { const f = make(lang, TODAY); for (const c of clients) out[lang].push({ c, stats: f.clStats(c), pat: f.clPatterns(c) }); }
const f = make('ru', TODAY);
for (const [i, t] of [[{ name: 'Пиво светлое', kcal: 300, p: 2 }, { k: 2000 }], [{ name: 'Пицца', kcal: 900, p: 30, ts: ts(TODAY, 23) }, { k: 2000 }], [{ name: 'Салат', kcal: 200, p: 10 }, { k: 2000 }], [{ name: 'Паста', kcal: 600, p: 10 }, { k: 2000 }], [{ name: 'Шоколад', kcal: 250, p: 3, ts: ts(TODAY, 2) }, null]]) out.flags.push({ i, t, v: f.mealFlag(i, t) });
writeFileSync('packages/calc/src/golden-clients.json', JSON.stringify(out));
console.log(out.ru.map((x) => [x.c.name, x.stats.flag, x.pat.map((p) => p.h)]), out.flags.map((x) => x.v));
