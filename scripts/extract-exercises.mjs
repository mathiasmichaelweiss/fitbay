// Достает из прототипа базу упражнений (exdb), картинки (eximg) и словари тренировок.
// Запуск: node scripts/extract-exercises.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('docs/prototype/kalorii.html', 'utf8');
const tag = (id) => html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`))[1];
const ex = JSON.parse(tag('exdb'));
writeFileSync('packages/shared/src/exercises/exdb.json', JSON.stringify(ex));
writeFileSync('apps/web/src/data/exercises/eximg.json', JSON.stringify(JSON.parse(tag('eximg'))));
const grab = (name) => {
  const i = html.indexOf(`const ${name}=`);
  let j = html.indexOf('=', i) + 1, depth = 0, k = j;
  for (; k < html.length; k++) {
    const c = html[k];
    if (c === '"') { k++; while (html[k] !== '"') { if (html[k] === '\\') k++; k++; } continue; }
    if (c === '{' || c === '[') depth++;
    if (c === '}' || c === ']') { depth--; if (!depth) break; }
  }
  return Function(`return (${html.slice(j, k + 1)})`)();
};
const out = {};
for (const n of ['DICT', 'PRE', 'GROUPS', 'EQ', 'WTAGS', 'AI_EQ']) out[n] = grab(n);
writeFileSync('packages/shared/src/exercises/dicts.json', JSON.stringify(out, null, 1));
console.log(ex.length, 'exercises', Object.keys(out.PRE).length, 'PRE', Object.keys(JSON.parse(tag('eximg'))).length, 'images');
