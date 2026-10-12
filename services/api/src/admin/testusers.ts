import type { Item, Repo } from '../lib/repo';

/**
 * A6.1 Тестовые пользователи владельца (TU_PRESETS и tuSeedTrainerDE прототипа).
 * uid тестового пользователя: <uid владельца>~<id>, владелец открывает его через заголовок x-act-as.
 * Все записи одного тестового пользователя помечены полем tu, чтобы удалить их целиком.
 */
export const TU_PRESETS: [string, string, string][] = [
  ['trainer_de', 'Тренер (Deutsch)', 'Тренер с 4 немецкими клиентами, пакеты, расписание, заметки, чек-ины и активная тренировка'],
  ['client_tr', 'Клиент у тестового тренера', 'Записан к тренеру, пакет занятий, рекомендации, заметка тренера, отмена тренером'],
  ['plan', 'Клиент с планом тренера', 'Roadmap из 3 фаз, тренировки, питание, история веса за 2 месяца'],
  ['empty', 'Новый пользователь', 'Пустой профиль, начинается с онбординга'],
];
export const TU_ROLES: Record<string, string> = { trainer_de: 'client,trainer', client_tr: 'client', plan: 'client', empty: 'client' };

const DAY = 864e5;
const D = (t: number) => new Date(t).toISOString().slice(0, 10);
const iso = (t: number) => new Date(t).toISOString();

export async function seedTestUser(repo: Repo, tu: string, kind: string, now: number): Promise<void> {
  const put = (it: Item) => repo.put({ ...it, tu, createdAt: it.createdAt ?? iso(now), updatedAt: iso(now) });
  const U = (u: string) => `USER#${u}`;
  const consent = { health: { v: 1, at: iso(now) } };

  if (kind === 'empty') return; // профиля нет: приложение откроет онбординг

  if (kind === 'plan') {
    await put({ PK: U(tu), SK: 'PROFILE', sex: 'm', birth: '1992-04-12', h: 182, w: 88.4, tw: 80, act: 1, goal: 'lose', lang: 'ru', consents: consent });
    for (let i = 60; i >= 0; i -= 2) {
      const w = +(92 - (60 - i) * 0.06 + Math.sin(i * 1.7) * 0.35).toFixed(1);
      await put({ PK: U(tu), SK: `MEASURE#${D(now - i * DAY)}`, date: D(now - i * DAY), weight: w, ...(i % 14 === 0 ? { waist: +(101 - (60 - i) * 0.08).toFixed(1) } : {}) });
    }
    await put({
      PK: U(tu), SK: 'PLAN', by: 'Андрей (тест)', current: 0, phaseStart: now - 21 * DAY, startW: 90.2, updatedAt: now, changes: ['goals', 'train', 'food'], history: [],
      phases: [
        { type: 'cut', name: 'Сушка до 84', pct: -20, prot: 2.2, end: { kind: 'weight', val: 84 }, note: 'Убираем жир с живота, сохраняем силу', workouts: [{ name: 'День A: верх', items: [{ id: 'Pullups', sets: 4, reps: '6-8' }, { id: 'Pushups', sets: 3, reps: '12-15' }] }, { name: 'День B: корпус', items: [{ id: 'Plank', sets: 3, reps: '40с' }] }], nutrition: { rules: ['Белок в каждом приёме пищи', 'Овощи минимум 2 раза в день', 'Сладкое только после тренировки'], menu: ['Завтрак: скир 500 г с ягодами ~420 ккал', 'Обед: курица 200 г, гречка 150 г, салат ~600 ккал', 'Ужин: рыба и овощи ~450 ккал'] } },
        { type: 'cut', name: 'Сушка до 80', pct: -15, prot: 2.2, end: { kind: 'weight', val: 80 }, note: 'Мягче дефицит, больше шагов', workouts: [{ name: 'Фулбоди', items: [{ id: 'Pullups', sets: 3, reps: '8' }, { id: 'Pushups', sets: 3, reps: '15' }, { id: 'Plank', sets: 3, reps: '60с' }] }], nutrition: { rules: ['Дефицит 15%', '10 000 шагов в день'], menu: [] } },
        { type: 'recomp', name: 'Рекомпозиция', pct: 0, prot: 2, end: { kind: 'none' }, note: 'Держим 80 кг, растим силу', workouts: [], nutrition: { rules: ['Калории по расходу'], menu: [] } },
      ],
    });
    return;
  }

  /* ---------- тренер Lukas Weber и 4 клиента (tuSeedTrainerDE) ---------- */
  const trainer = async (TR: string, hidden: boolean) =>
    put({
      PK: `TRAINER#${TR}`, SK: 'PROFILE', uid: TR, name: 'Lukas Weber', hidden, partner: true, city: 'Stuttgart', level: 'Personal Trainer', price: 'ab 60 €', gym: 'FitX Stuttgart-Mitte',
      about: 'Personal Trainer seit 8 Jahren. Schwerpunkt Kraft, Rücken und gesunde Ernährung.', tags: ['Kraft', 'Rücken', 'Abnehmen'], formats: ['Online', 'Studio'], exp: 8, sex: 'm', edu: ['trainer'], online: true, color: '#B2D8D8',
      packages: [{ id: 'p1', name: 'Technik-Check, 3 Trainings', price: '150 €', desc: 'Drei Einheiten mit Fokus auf saubere Technik' }, { id: 'p2', name: 'Personal Training, 10 Einheiten', price: '550 €', desc: 'Zehn Einheiten im Studio inkl. Trainingsplan' }, { id: 'p3', name: 'Ernährungsberatung', price: '120 €', desc: 'Analyse deiner Ernährung und persönlicher Plan' }],
      rates: { on: 40, gym: 60, food: 50 },
      ...(hidden ? {} : { GSI2PK: 'CATALOG', GSI2SK: '000050' }),
    });
  const slot = (TR: string, id: string, s: Record<string, unknown>) =>
    put({ PK: `TRAINER#${TR}`, SK: `SLOT#${id}`, trainer: TR, dur: 60, place: 'gym', addr: 'FitX Stuttgart-Mitte', bookedBy: null, ...s, ...(s.bookedBy ? { GSI1PK: `CLIENT#${s.bookedBy}`, GSI1SK: `SLOT#${s.start}` } : {}) });
  const at = (i: number, h: number) => {
    const d = new Date(now + i * DAY);
    d.setHours(h, 0, 0, 0);
    return +d;
  };
  const req = (TR: string, id: string, r: Record<string, unknown>) => put({ PK: `TRAINER#${TR}`, SK: `REQ#${id}`, GSI1PK: `CLIENT#${r.uid}`, GSI1SK: `REQ#${r.at}`, trainer: TR, v: 1, ...r });

  if (kind === 'client_tr') {
    // клиент (сам тестовый пользователь) у тестового тренера: запись, пакет, рекомендации, заметка, отмена тренером
    const TR = `${tu}_tr`;
    await trainer(TR, false);
    await put({ PK: U(tu), SK: 'PROFILE', sex: 'm', birth: '1995-10-23', h: 185, w: 83, tw: 80, act: 3, goal: 'recomp', lang: 'ru', consents: consent });
    await put({ PK: `TRAINER#${TR}`, SK: `CLIENT#${tu}`, GSI1PK: `CLIENT#${tu}`, GSI1SK: `LINK#${TR}`, consent: true, since: now - 20 * DAY, name: 'Матиас (тест)' });
    await slot(TR, 'past', { start: at(-3, 18), bookedBy: tu, bookedName: 'Матиас (тест)', bookedAt: now - 5 * DAY, session: { title: 'Rücken & Technik', start: at(-3, 18), end: at(-3, 18) + 55 * 6e4, items: [{ id: 'Pullups', name: 'Klimmzüge', sets: [{ r: 8, w: 0 }, { r: 7, w: 0 }] }], tags: ['tech'], note: '' }, tnote: { tags: ['tech'], note: 'Локти ближе к корпусу в подтягиваниях', at: at(-3, 19), by: 'Lukas Weber' } });
    await slot(TR, 'next', { start: at(1, 18), bookedBy: tu, bookedName: 'Матиас (тест)', bookedAt: now - DAY, plan: { name: 'Верх тела', note: 'Возьми резинку', items: [{ id: 'Pullups', sets: 4, reps: '6-8' }, { id: 'Pushups', sets: 3, reps: '12' }] } });
    await slot(TR, 'cxl', { start: at(2, 10), cancel: { by: 'trainer', name: 'Матиас (тест)', uid: tu, at: now - 3 * 36e5, reason: 'Krank, sorry', tname: 'Lukas Weber' }, cancelledFor: tu });
    for (const [i, h] of [[2, 18], [3, 9], [3, 10], [4, 18]] as const) await slot(TR, `f${i}_${h}`, { start: at(i, h) });
    await req(TR, 'r1', { uid: tu, name: 'Матиас (тест)', pkg: { id: 'p2', name: 'Personal Training, 10 Einheiten', price: '550 €' }, msg: '', contact: '@test', status: 'accepted', answer: 'Gerne!', at: now - 20 * DAY, answeredAt: now - 20 * DAY, sessions: { total: 10 }, adj: 7, log: [{ d: 1, at: now - 2 * DAY, by: 'Lukas Weber' }] });
    await put({ PK: U(tu), SK: 'TIPS', items: [{ id: 't1', text: 'Добавь 30 г белка к завтраку: скир или яйца', cat: 'food', from: 'Lukas Weber', ts: now - 2 * DAY, done: false }, { id: 't2', text: 'Перед тренировкой 10 минут разминки', cat: 'train', from: 'Lukas Weber', ts: now - DAY, done: false }] });
    const n = (k: number, x: Record<string, unknown>) => put({ PK: U(tu), SK: `NOTIF#${String(now - k).padStart(15, '0')}_000000_tu${k}`, at: now - k, read: false, ...x });
    await n(3 * 36e5, { type: 'cancel', by: 'trainer', trainer: TR, start: at(2, 10), reason: 'Krank, sorry' });
    await n(2 * DAY, { type: 'sess_charged', trainer: TR, req: 'r1', d: 1 });
    await n(20 * DAY, { type: 'req_accepted', trainer: TR, req: 'r1', sessions: 10 });
    return;
  }

  // trainer_de: сам тестовый пользователь и есть тренер
  const TR = tu;
  await put({ PK: U(tu), SK: 'PROFILE', sex: 'm', birth: '1990-03-14', h: 181, w: 82, tw: 80, act: 3, goal: 'keep', lang: 'de', consents: consent });
  await trainer(TR, true);
  const meals: [string, string, number, number][] = [
    ['Frühstück', 'Haferflocken mit Beeren und Skyr', 520, 32], ['Mittag', 'Hähnchen mit Reis und Brokkoli', 680, 48], ['Snack', 'Apfel und Mandeln', 230, 6], ['Abend', 'Vollkornbrot mit Käse und Tomaten', 560, 26],
    ['Abend', 'Lachs mit Kartoffeln und Salat', 640, 40], ['Snack', 'Proteinriegel', 210, 20], ['Mittag', 'Spaghetti Bolognese', 780, 34], ['Abend', 'Pizza Margherita (halb)', 620, 24],
  ];
  const CL: [string, string, 'm' | 'f', number, number, number, number, string, number][] = [
    ['anna', 'Anna Schmidt', 'f', 29, 168, 66, 61, 'lose', 3], ['jonas', 'Jonas Becker', 'm', 34, 183, 88, 82, 'lose', 3],
    ['lena', 'Lena Hoffmann', 'f', 41, 165, 72, 68, 'recomp', 1], ['max', 'Max Müller', 'm', 25, 179, 74, 78, 'gain', 5],
  ];
  const W: [string, [string, string, [number, number][]][]][] = [
    ['Oberkörper', [['BB', 'Bankdrücken', [[8, 70], [8, 70], [7, 72.5]]], ['Pullups', 'Klimmzüge', [[8, 0], [7, 0], [6, 0]]]]],
    ['Unterkörper', [['Barbell_Full_Squat', 'Kniebeugen', [[6, 90], [6, 90], [5, 95]]], ['Romanian_Deadlift', 'Rumänisches Kreuzheben', [[10, 70], [10, 70]]]]],
    ['Ganzkörper', [['Barbell_Deadlift', 'Kreuzheben', [[5, 120], [5, 120]]], ['Plank', 'Planke', [[60, 0], [60, 0]]]]],
  ];
  const notes: Record<string, { tags: string[]; note: string; ex?: { tags: string[]; note: string } }[]> = {
    anna: [{ tags: ['pain'], note: 'Rechte Schulter zieht beim Bankdrücken', ex: { tags: ['pain'], note: 'Ab dem 2. Satz Schmerzen' } }, { tags: ['easy'], note: 'Heute lief alles super' }],
    jonas: [{ tags: ['hard'], note: 'Wenig geschlafen, letzte Sätze sehr schwer' }, { tags: ['tech'], note: 'Bin mir bei der Kniebeuge-Tiefe unsicher' }],
    lena: [{ tags: ['pain'], note: 'Unterer Rücken nach dem Kreuzheben' }],
    max: [{ tags: ['easy'], note: 'Gewicht kann hoch' }],
  };
  const slotMap: Record<string, string[]> = { breakfast: ['Frühstück'], lunch: ['Mittag'], snack: ['Snack'], dinner: ['Abend'] };
  const slotOf = (s: string) => Object.keys(slotMap).find((k) => slotMap[k]!.includes(s)) ?? 'snack';
  for (const [k, name, sex, ag, h, w, tw, goal, act] of CL) {
    const cid = `${TR}_${k}`;
    await put({ PK: U(cid), SK: 'PROFILE', name, sex, birth: `${new Date(now).getFullYear() - ag}-05-10`, h, w, tw, act, goal, lang: 'de', consents: consent });
    await put({ PK: `TRAINER#${TR}`, SK: `CLIENT#${cid}`, GSI1PK: `CLIENT#${cid}`, GSI1SK: `LINK#${TR}`, consent: true, since: now - 60 * DAY, name });
    const scale = goal === 'lose' ? (sex === 'f' ? 1650 : 2200) / 2100 : goal === 'gain' ? 2900 / 2100 : 1950 / 2100;
    for (let i = 13; i >= 0; i--) {
      const d = D(now - i * DAY);
      const its = [0, 1, 2, i % 2 ? 3 : 4].map((j) => meals[(j + i) % meals.length]!);
      const kf = 1 + (((i * 37 + k.length * 13) % 30) - 12) / 100;
      for (const [j, x] of its.entries()) {
        const ts = now - i * DAY - (12 - j * 3) * 36e5;
        await put({ PK: U(cid), SK: `MEAL#${d}#tu${i}${j}`, date: d, ts, name: x[1], kcal: Math.round(x[2] * kf * scale), protein: Math.round(x[3] * kf), fat: 18, carbs: 55, slot: slotOf(x[0]), grams: 300 });
      }
    }
    for (const [n, i] of [1, 3, 6, 8, 10, 13].entries()) {
      const t = W[n % 3]!;
      const nt = notes[k]?.[n] ?? { tags: [], note: '' };
      const end = now - i * DAY;
      await put({
        PK: U(cid), SK: `WORKOUT#${D(end)}#tu${n}`, date: D(end), start: end - (55 + n * 2) * 6e4, end, title: t[0], kcal: 300 + n * 15, tags: nt.tags, note: nt.note,
        items: t[1].map(([id, nm, ss], j) => ({ id, name: nm, sets: ss.map(([r, wt]) => ({ r, w: wt, d: true })), ...(j === 0 && nt.ex ? nt.ex : {}) })),
      });
    }
    await put({ PK: U(cid), SK: `ACT#${D(now - DAY)}#tu`, date: D(now - DAY), at: now - DAY, name: 'Spaziergang', kcal: 180, min: 45, steps: 6500, src: 'text' });
    for (let i = 56; i >= 0; i -= 7) {
      const wt = +(w + (goal === 'lose' ? i * 0.04 : goal === 'gain' ? -i * 0.03 : 0) + ((i / 7) % 2 ? 0.3 : -0.2)).toFixed(1);
      await put({ PK: U(cid), SK: `MEASURE#${D(now - i * DAY)}`, date: D(now - i * DAY), weight: wt, ...(i % 14 === 0 ? { waist: +((sex === 'f' ? 72 : 90) + i * 0.05).toFixed(1) } : {}) });
    }
    for (let i = 13; i >= 0; i--) {
      const bad = k === 'lena' && i < 3;
      await put({
        PK: U(cid), SK: `CHECKIN#${D(now - i * DAY)}`, date: D(now - i * DAY), at: now - i * DAY,
        sleep: bad ? 2 : 4, energy: bad ? 2 : i % 3 ? 4 : 3, stress: bad ? 2 : 3, hunger: k === 'jonas' && i < 5 ? 2 : 3, pain: k === 'lena' && i < 4 ? 1 : 5, adh: k === 'max' ? 5 : 4,
        ...(bad && i === 0 ? { note: 'Rücken tut weh, schlecht geschlafen' } : {}),
      });
    }
    await put({ PK: U(cid), SK: 'TIPS', items: [{ id: 't1', text: k === 'jonas' ? 'Mehr Eiweiß zum Frühstück, z. B. Skyr oder Eier' : 'Trink mindestens 2 Liter Wasser am Tag', cat: 'food', from: 'Lukas Weber', ts: now - 3 * DAY, done: k !== 'jonas', doneAt: k !== 'jonas' ? now - 2 * DAY : null }, { id: 't2', text: 'Vor dem Training 10 Minuten aufwärmen', cat: 'train', from: 'Lukas Weber', ts: now - DAY, done: false }] });
  }
  await put({
    PK: U(`${TR}_jonas`), SK: 'PLAN', by: 'Lukas Weber', current: 0, phaseStart: now - 20 * DAY, startW: 90, updatedAt: now - DAY, changes: ['goals', 'train', 'food'], history: [],
    phases: [
      { type: 'cut', name: 'Diät bis 84 kg', mode: 'flex', days: [1, 3, 5], tp: 190, tf: 65, tc: 230, rp: 190, rf: 70, rc: 140, prot: 2.2, end: { kind: 'weight', val: 84 }, note: 'Bauchfett runter, Kraft halten', workouts: [{ name: 'Tag A: Oberkörper', items: [{ id: 'Pullups', sets: 4, reps: '6-8' }, { id: 'Pushups', sets: 3, reps: '12' }] }, { name: 'Tag B: Rumpf', items: [{ id: 'Plank', sets: 3, reps: '45s' }] }], nutrition: { rules: ['Eiweiß in jeder Mahlzeit', 'Gemüse zweimal täglich', 'Süßes nur nach dem Training'], menu: ['Frühstück: 500 g Skyr mit Beeren', 'Mittag: Hähnchen, Reis, Salat', 'Abend: Fisch mit Gemüse'] } },
      { type: 'recomp', name: 'Rekomposition', pct: 0, prot: 2, end: { kind: 'none' }, note: 'Gewicht halten, Kraft aufbauen', workouts: [], nutrition: { rules: ['Kalorien nach Verbrauch'], menu: [] } },
    ],
  });
  const nm = (k: string) => CL.find((c) => c[0] === k)![1];
  const bk = (k: string | null) => (k ? { bookedBy: `${TR}_${k}`, bookedName: nm(k), bookedAt: now - 3 * DAY } : {});
  await slot(TR, 's-3_18', { start: at(-3, 18), ...bk('jonas'), plan: { name: 'Rücken & Technik', items: [{ id: 'Pullups', sets: 4, reps: '6-8' }] }, session: { title: 'Rücken & Technik', start: at(-3, 18), end: at(-3, 18) + 33e5, items: [{ id: 'Pullups', name: 'Klimmzüge', sets: [{ r: 8, w: 0 }, { r: 7, w: 0 }, { r: 6, w: 0 }] }], tags: ['tech'], note: '' }, tnote: { tags: ['tech'], note: 'Ellbogen beim Klimmzug näher am Körper halten', at: at(-3, 19), by: 'Lukas Weber' } });
  await slot(TR, 's-2_10', { start: at(-2, 10), ...bk('anna'), tnote: { tags: ['pain'], note: 'Schulter schonen, Bankdrücken durch Kurzhanteln ersetzt', at: at(-2, 11), by: 'Lukas Weber' } });
  await slot(TR, 's-1_17', { start: at(-1, 17), ...bk('max'), session: { title: 'Ganzkörper', start: at(-1, 17), end: at(-1, 17) + 35e5, items: [{ id: 'Plank', name: 'Planke', sets: [{ r: 60, w: 0 }, { r: 60, w: 0 }] }], tags: ['easy'], note: 'Gutes Tempo' }, tnote: { tags: ['easy'], note: 'Nächstes Mal mehr Gewicht', at: at(-1, 18), by: 'Lukas Weber' } });
  const live = now - 20 * 6e4;
  await slot(TR, 'live', { start: live, ...bk('lena'), bookedAt: now - 2 * DAY, plan: { name: 'Rücken & Rumpf', items: [{ id: 'Plank', sets: 3, reps: '45s' }, { id: 'Pushups', sets: 3, reps: '10' }] }, live: { start: live } });
  for (const [i, h, k] of [[1, 18, 'jonas'], [1, 19, null], [2, 9, 'anna'], [2, 10, null], [3, 18, 'max']] as const) await slot(TR, `s${i}_${h}`, { start: at(i, h), ...bk(k) });
  await req(TR, 'r1', { uid: `${TR}_jonas`, name: 'Jonas Becker', pkg: { id: 'p2', name: 'Personal Training, 10 Einheiten', price: '550 €' }, msg: '', contact: 'jonas@example.de', status: 'accepted', answer: 'Gerne!', at: now - 30 * DAY, answeredAt: now - 30 * DAY, sessions: { total: 10 }, adj: 7 });
  await req(TR, 'r2', { uid: `${TR}_anna`, name: 'Anna Schmidt', pkg: { id: 'p1', name: 'Technik-Check, 3 Trainings', price: '150 €' }, msg: '', contact: '@anna.fit', status: 'accepted', answer: '', at: now - 10 * DAY, answeredAt: now - 10 * DAY, sessions: { total: 3 }, adj: 1 });
  await req(TR, 'r3', { uid: `${TR}_max`, name: 'Max Müller', pkg: { id: 'p3', name: 'Ernährungsberatung', price: '120 €' }, msg: 'Ich möchte Muskeln aufbauen und brauche einen Ernährungsplan.', contact: '0171 1234567', status: 'new', answer: '', at: now - 5 * 36e5 });
  const n = (k: number, x: Record<string, unknown>) => put({ PK: U(TR), SK: `NOTIF#${String(now - k).padStart(15, '0')}_000000_tu${k}`, at: now - k, read: false, ...x });
  await n(5 * 36e5, { type: 'request', client: `${TR}_max`, req: 'r3' });
  await n(3 * DAY, { type: 'booked', client: `${TR}_jonas`, name: 'Jonas Becker', start: at(1, 18) });
  await put({
    PK: U(TR), SK: 'WOACTIVE', forClient: { id: `${TR}_lena`, name: 'Lena Hoffmann', slot: 'live' }, title: 'Rücken & Rumpf', start: live, progId: null,
    items: [{ id: 'Plank', target: '45s', sets: [{ r: '45', w: '', d: true }, { r: '', w: '', d: false }, { r: '', w: '', d: false }] }, { id: 'Pushups', target: '10', sets: [{ r: '', w: '', d: false }, { r: '', w: '', d: false }, { r: '', w: '', d: false }] }],
  });
}

/** Все PK тестового пользователя (сам, клиенты, тренер), чтобы удалить целиком. */
export async function deleteTestUser(repo: Repo, pks: string[]): Promise<number> {
  let n = 0;
  for (const pk of pks)
    for (const it of await repo.query(pk, {})) {
      await repo.delete(it.PK, it.SK);
      n++;
    }
  return n;
}
export const tuPks = (tu: string, kind: string): string[] => {
  const base = [`USER#${tu}`];
  if (kind === 'trainer_de') return [...base, `TRAINER#${tu}`, ...['anna', 'jonas', 'lena', 'max'].map((k) => `USER#${tu}_${k}`)];
  if (kind === 'client_tr') return [...base, `TRAINER#${tu}_tr`];
  return base;
};
