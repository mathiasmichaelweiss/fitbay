// Эталоны генератора пакетов (rates, volPct, pkgPrice, tPrice прототипа). node scripts/golden-pkgprice.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('docs/prototype/kalorii.html', 'utf8');
const line = (h) => { const k = html.indexOf(h); return html.slice(k, html.indexOf('\n', k)); };
const code = [line('function rates(t)'), line('function volPct(r,ses)'), line('function pkgPrice(r,c)'), line('function tPrice(t)')].join('\n');
const fn = Function(`${code}; return {rates, volPct, pkgPrice, tPrice};`)();
const T = [
  {}, { rates: { on: 40, gym: 60, food: 0, dur: { 3: 8 }, vol: [{ min: 10, pct: 5 }, { min: 30, pct: 12 }] } }, { rates: { on: 0, gym: 55, vol: [] } },
  { price: 'ab 60 €' }, { price: 'договорная' }, { rates: { on: 35, gym: 0 }, price: '100 €' },
];
const C = [];
for (const freq of [1, 2, 3, 4]) for (const place of ['online', 'gym']) for (const months of [1, 3, 6]) for (const food of [true, false]) C.push({ freq, place, months, food });
const out = T.map((t) => { const r = fn.rates(t); return { t, r, tPrice: fn.tPrice(t), prices: C.map((c) => ({ c, p: fn.pkgPrice(r, c) })) }; });
writeFileSync('packages/calc/src/golden-pkgprice.json', JSON.stringify(out));
console.log(out.map((x) => [x.tPrice, x.prices[5].p.total]));
