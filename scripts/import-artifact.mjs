// Переносит пользователя из базы артефакта-прототипа (выгрузка data/users/<id>/*.json)
// в локальную базу API (services/api/.data/db.json) под dev-пользователем.
// Переводы упражнений (tr) уходят в общий кэш (db.shared-food.json рядом с базой).
// Запуск: node scripts/import-artifact.mjs <папка выгрузки> [uid=local] [db=services/api/.data/db.json]
import fs from 'node:fs';
import path from 'node:path';

const [dir, uid = 'local', dbFile = 'services/api/.data/db.json'] = process.argv.slice(2);
if (!dir) throw new Error('usage: import-artifact.mjs <dump dir> [uid] [db file]');
const PK = `USER#${uid}`;
const iso = (ms) => new Date(ms || Date.now()).toISOString();
const docs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return { id: f.replace(/\.json$/, ''), ...(raw.data ?? raw) };
});
const items = [];
const add = (SK, d, at) => {
  const { id: _i, type: _t, ...rest } = d;
  items.push({ ...rest, PK, SK, createdAt: iso(at), updatedAt: iso(at) });
};
const skipped = {};
const shared = [];
for (const d of docs) {
  switch (d.type) {
    case 'settings': {
      const p = d.profile ?? {};
      const consents = Object.fromEntries(Object.entries(d.consents ?? {}).map(([k, v]) => [k, { v: v.version ?? v.v ?? 1, at: iso(v.at) }]));
      add('PROFILE', { ...p, lang: d.lang, actGoal: d.actGoal, actPct: d.actPct, consents, ...(d.onboarded ? { onboarded: iso(d.onboarded) } : {}), ...(d.share ? { share: d.share } : {}) }, d.onboarded);
      break;
    }
    case 'meal': add(`MEAL#${d.date}#${d.id}`, d, d.ts); break;
    case 'recipe': add(`RECIPE#${d.id}`, d, +d.id.slice(1)); break;
    case 'coach': add(`COACH#${d.date}`, d, d.at); break;
    case 'measure': add(`MEASURE#${d.date}`, d, d.at); break;
    case 'checkin': add(`CHECKIN#${d.date}`, d, d.at); break;
    case 'workout': add(`WORKOUT#${d.date}#${d.id}`, d, d.end); break;
    case 'program': add(`PROGRAM#${d.id}`, { ...d, date: iso(d.at).slice(0, 10) }, d.at); break;
    case 'activity': add(`ACT#${d.date}#${d.id}`, d, d.at); break;
    case 'wcorr': add('WCORR', d, Date.now()); break;
    case 'woactive':
      if (!d.none) add('WOACTIVE', d, d.start);
      else skipped.woactive = (skipped.woactive ?? 0) + 1;
      break;
    case 'tr': {
      const m = d.id.match(/^tr-(names|ex)-(ru|de)(?:-(.+))?$/);
      if (m && m[1] === 'names') shared.push({ PK: `EXTR#${m[2]}`, SK: 'NAMES', map: d.map });
      else if (m && m[3]) shared.push({ PK: `EXTR#${m[2]}`, SK: `EX#${m[3]}`, t: d.t });
      break;
    }
    default: skipped[d.type] = (skipped[d.type] ?? 0) + 1;
  }
}
let db = [];
try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { /* новой базы нет */ }
db = db.filter((r) => r.PK !== PK).concat(items);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.writeFileSync(dbFile, JSON.stringify(db, null, 1));
if (shared.length) {
  const sf = dbFile.replace(/\.json$/, '.shared-food.json');
  let sd = [];
  try { sd = JSON.parse(fs.readFileSync(sf, 'utf8')); } catch { /* нет */ }
  const keys = new Set(shared.map((r) => r.PK + '|' + r.SK));
  // уже переведенное в общем кэше дополняем, а не затираем
  for (const r of shared) {
    const old = sd.find((x) => x.PK === r.PK && x.SK === r.SK);
    if (old && r.map) r.map = { ...old.map, ...r.map };
  }
  sd = sd.filter((x) => !keys.has(x.PK + '|' + x.SK)).concat(shared);
  fs.writeFileSync(sf, JSON.stringify(sd, null, 1));
  console.log('shared translations', shared.length, '->', sf);
}
const count = {};
for (const i of items) { const k = i.SK.split('#')[0]; count[k] = (count[k] ?? 0) + 1; }
console.log('imported', count, 'skipped', skipped, '->', dbFile);
