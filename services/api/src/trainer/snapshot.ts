import { age, target, woKcal, type CalcProfile } from '@fitbay/calc';
import type { Item, Repo } from '../lib/repo';

/**
 * Снимок клиента для тренера (shareSnapshot прототипа), но собирается на сервере из настоящих данных клиента,
 * поэтому всегда свежий. Читается только при действующем согласии (проверяет вызывающий код).
 */
const U = (uid: string) => `USER#${uid}`;
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;
const pick = (it: Item, drop: string[]) => Object.fromEntries(Object.entries(it).filter(([k]) => !['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK', ...drop].includes(k)));

export async function clientSnapshot(repo: Repo, cid: string, today: string) {
  const from = shift(today, -30);
  const pk = U(cid);
  const [prof, meals, wos, acts, cis, ms, tips, ba] = await Promise.all([
    repo.get(pk, 'PROFILE'),
    repo.query(pk, { from: `MEAL#${from}`, to: `MEAL#${today}￿` }),
    repo.query(pk, { from: `WORKOUT#${from}`, to: `WORKOUT#${today}￿` }),
    repo.query(pk, { from: `ACT#${from}`, to: `ACT#${today}￿` }),
    repo.query(pk, { from: `CHECKIN#${from}`, to: `CHECKIN#${today}￿` }),
    repo.query(pk, { prefix: 'MEASURE#' }),
    repo.get(pk, 'TIPS'),
    repo.get(pk, 'BA'),
  ]);
  const p = (prof ?? {}) as unknown as CalcProfile & { actPct?: number; tw?: number; name?: string };
  const t = prof ? target(p, today, { pct: p.actPct ?? 0.5 }) : null;
  const by: Record<string, { d: string; k: number; p: number; f: number; c: number; n: number; items: { name: string; kcal: number; p: number; slot: string | null; ts?: number }[] }> = {};
  for (const m of meals) {
    const d = String(m.date);
    const x = (by[d] ??= { d, k: 0, p: 0, f: 0, c: 0, n: 0, items: [] });
    x.k += num(m.kcal);
    x.p += num(m.protein);
    x.f += num(m.fat);
    x.c += num(m.carbs);
    x.n++;
    x.items.push({ name: String(m.name ?? ''), kcal: num(m.kcal), p: num(m.protein), slot: (m.slot as string) ?? null, ts: num(m.ts) || Date.parse(String(m.createdAt ?? '')) || undefined });
  }
  const stamps = [prof, ...meals, ...wos, ...acts, ...cis, ...ms].map((x) => Date.parse(String(x?.updatedAt ?? x?.createdAt ?? ''))).filter((x) => x > 0);
  return {
    profile: prof ? { sex: p.sex, age: p.birth ? age(p.birth, today) : p.age, h: p.h, w: p.w, tw: p.tw, act: p.act, goal: p.goal } : null,
    targets: t ? { k: t.k, p: t.p, f: t.f, c: t.c } : null,
    days: Object.values(by).sort((a, b) => (a.d < b.d ? -1 : 1)),
    workouts: wos
      .map((w) => ({
        id: w.SK.slice(w.SK.indexOf('#') + 1),
        date: String(w.date),
        at: num(w.end) || null,
        title: String(w.title ?? ''),
        min: Math.round((num(w.end) - num(w.start)) / 60000),
        kcal: woKcal(num(w.start), num(w.end), (w.items as { sets?: unknown[] }[]) ?? [], num(w.kcal) || undefined, p.w),
        tags: (w.tags as string[]) ?? [],
        note: String(w.note ?? ''),
        plan: w.plan ?? null,
        items: ((w.items as Record<string, unknown>[]) ?? []).map((i) => ({ id: i.id ?? null, name: i.name ?? '', tags: i.tags ?? [], note: i.note ?? '', sets: ((i.sets as { r: number; w: number }[]) ?? []).map((x) => ({ r: x.r, w: x.w })) })),
      }))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    activities: acts.map((a) => ({ date: String(a.date), name: String(a.name ?? ''), kcal: num(a.kcal), min: num(a.min), steps: num(a.steps) || null })),
    checkins: cis.map((x) => pick(x, ['createdAt', 'updatedAt'])),
    measures: ms.map((m) => pick(m, ['createdAt', 'updatedAt', 'at'])).sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1)).slice(-12),
    tips: (tips?.items as unknown[]) ?? [],
    ba: ba && !ba.none ? pick(ba, ['createdAt', 'updatedAt']) : null,
    updatedAt: stamps.length ? Math.max(...stamps) : null,
  };
}
