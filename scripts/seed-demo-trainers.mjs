// Демо-тренеры для локальной разработки (до A6.1): два тренера в каталоге с пакетами, ставками и окнами на 2 недели.
// Данные взяты из пресета trainer_de прототипа (Lukas Weber) и дополнены вторым тренером.
// Запуск: node scripts/seed-demo-trainers.mjs [db=services/api/.data/db.json]
import fs from 'node:fs';
import path from 'node:path';

const dbFile = process.argv[2] ?? 'services/api/.data/db.json';
let db = [];
try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { /* новая база */ }
const iso = (ms) => new Date(ms).toISOString();
const T = [
  {
    tid: 'demo-lukas', order: '000100',
    p: { name: 'Lukas Weber', spec: 'Kraft, Rücken und gesunde Ernährung', about: 'Personal Trainer seit 8 Jahren. Schwerpunkt Kraft, Rücken und gesunde Ernährung.', city: 'Stuttgart', level: 'Personal Trainer', price: 'ab 60 €', gym: 'FitX Stuttgart-Mitte', exp: 8, sex: 'm', edu: ['trainer', 'nutri'], online: true, formats: ['Online', 'Studio'], tags: ['Kraft', 'Rücken', 'Abnehmen'], color: '#B2D8D8',
      packages: [{ id: 'p1', name: 'Technik-Check, 3 Trainings', price: '150 €', desc: 'Drei Einheiten mit Fokus auf saubere Technik' }, { id: 'p2', name: 'Personal Training, 10 Einheiten', price: '550 €', desc: 'Zehn Einheiten im Studio inkl. Trainingsplan' }, { id: 'p3', name: 'Ernährungsberatung', price: '120 €', desc: 'Analyse deiner Ernährung und persönlicher Plan' }],
      rates: { on: 40, gym: 60, food: 50, dur: { 3: 5, 6: 10 }, vol: [{ min: 20, pct: 5 }] } },
    place: 'gym', addr: 'FitX Stuttgart-Mitte', hours: [9, 18, 19],
  },
  {
    tid: 'demo-anna', order: '000200',
    p: { name: 'Анна Ковалёва', spec: 'Похудение и осанка, онлайн', about: 'Тренер и нутрициолог. Веду онлайн, помогаю сбросить вес без срывов и выстроить привычки.', city: 'Онлайн', level: 'Online-Coach', price: 'от 35 €', exp: 4, sex: 'f', edu: ['nutri'], online: true, formats: ['Online'], tags: ['Похудение', 'Осанка'], color: '#F6B89A',
      packages: [{ id: 'p1', name: 'Старт, 4 тренировки', price: '130 €', desc: 'Месяц онлайн, раз в неделю' }],
      rates: { on: 35, gym: 0, food: 40 } },
    place: 'online', addr: '', hours: [8, 20],
  },
];
const items = [];
const now = Date.now();
for (const t of T) {
  const PK = `TRAINER#${t.tid}`;
  items.push({ ...t.p, hidden: false, partner: false, uid: t.tid, PK, SK: 'PROFILE', GSI2PK: 'CATALOG', GSI2SK: t.order, updatedAt: iso(now) });
  for (let d = 1; d <= 14; d++) {
    const day = new Date(now + d * 864e5);
    if ([0, 6].includes(day.getDay())) continue;
    for (const h of t.hours) {
      day.setHours(h, 0, 0, 0);
      const s = +day;
      items.push({ start: s, dur: 60, place: t.place, addr: t.addr, bookedBy: null, createdAt: now, trainer: t.tid, PK, SK: `SLOT#${iso(s)}_demo` });
    }
  }
}
const keys = new Set(items.map((r) => `${r.PK}|${r.SK}`));
// старые демо-окна убираем, записи клиентов на них не трогаем
db = db.filter((r) => !keys.has(`${r.PK}|${r.SK}`) && !(T.some((t) => r.PK === `TRAINER#${t.tid}`) && String(r.SK).startsWith('SLOT#') && !r.bookedBy));
db = db.concat(items.filter((r) => !db.some((x) => x.PK === r.PK && x.SK === r.SK)));
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
fs.writeFileSync(dbFile, JSON.stringify(db, null, 1));
console.log('demo trainers', T.length, 'items', items.length, '->', dbFile);
