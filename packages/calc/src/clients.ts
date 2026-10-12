/**
 * Кабинет тренера: clStats, clPatterns, mealFlag прототипа. Эталоны: golden-clients.json.
 * Тексты паттернов дословно; заголовки (h) это ключи перевода, пояснения (x) уже на языке lang, как в прототипе.
 */

export interface ClDay {
  d: string;
  k: number;
  p: number;
  f?: number;
  c?: number;
  items?: { name: string; kcal?: number; p?: number; slot?: string | null; ts?: number }[];
}
export interface ClSnap {
  profile?: { goal?: string; act?: number; w?: number; tw?: number };
  targets?: { k?: number; p?: number; f?: number; c?: number };
  days?: ClDay[];
  workouts?: { date: string }[];
  measures?: { date: string; w?: number; weight?: number }[];
}

/** GOALN прототипа: подписи целей (ключи перевода). */
export const GOALN: Record<string, string> = { lose: 'Похудение', recomp: 'Рекомпозиция', keep: 'Удержание', gain: 'Набор мышц' };

const shiftIso = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

/** clStats(): среднее за 7 дней с записями, тренировки за 7 дней, флаг (серый: нет данных, оранжевый: белок < 80% или ккал > 110%). */
export function clStats(c: ClSnap, today: string) {
  const days = (c.days ?? []).slice(-7);
  const n = days.length || 1;
  const t = c.targets ?? {};
  const k = days.reduce((a, d) => a + d.k, 0) / n;
  const p = days.reduce((a, d) => a + d.p, 0) / n;
  const wk = (c.workouts ?? []).filter((w) => w.date > shiftIso(today, -7)).length;
  const last = (c.days ?? []).slice(-1)[0];
  const flag: 'gray' | 'orange' | 'green' = !days.length ? 'gray' : p < (t.p || 1) * 0.8 || k > (t.k || 1) * 1.1 ? 'orange' : 'green';
  return { k: Math.round(k), p: Math.round(p), wk, last, flag, t };
}

export type PatLevel = 'good' | 'warn' | 'bad';
export interface Pattern {
  l: PatLevel;
  h: string;
  x: string;
}

/** clPatterns(): поведенческие паттерны за 14 дней, сначала проблемы. */
export function clPatterns(c: ClSnap, today: string, lang: 'ru' | 'de', tr: (s: string) => string = (s) => s): Pattern[] {
  const t = { k: 0, p: 0, ...(c.targets ?? {}) } as { k: number; p: number };
  const p = c.profile ?? {};
  const D = (c.days ?? []).slice(-14);
  const out: Pattern[] = [];
  if (!D.length) return out;
  const de = lang === 'de';
  const pct = (x: number) => Math.round(x * 100);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const wd = (d: string) => new Date(`${d}T12:00`).getDay();
  const pHit = D.filter((d) => d.p >= t.p * 0.9).length / D.length;
  out.push(
    pHit >= 0.75
      ? { l: 'good', h: 'Белок под контролем', x: de ? `Eiweißziel an ${pct(pHit)}% der Tage erreicht.` : `Норма белка выполнена в ${pct(pHit)}% дней.` }
      : {
          l: pHit < 0.4 ? 'bad' : 'warn',
          h: 'Недобор белка',
          x: de
            ? `Eiweißziel nur an ${pct(pHit)}% der Tage, im Schnitt ${Math.round(avg(D.map((d) => d.p)))} von ${t.p} g. Risiko, Muskeln statt Fett zu verlieren.`
            : `Норма белка только в ${pct(pHit)}% дней, в среднем ${Math.round(avg(D.map((d) => d.p)))} из ${t.p} г. Риск терять мышцы вместо жира.`,
        },
  );
  const kIn = D.filter((d) => Math.abs(d.k - t.k) <= t.k * 0.1).length / D.length;
  const over = D.filter((d) => d.k > t.k * 1.1).length;
  out.push(
    kIn >= 0.7
      ? { l: 'good', h: 'Стабильно в калориях', x: de ? `${pct(kIn)}% der Tage im Bereich ±10% vom Ziel.` : `${pct(kIn)}% дней в коридоре ±10% от нормы.` }
      : {
          l: over > D.length / 3 ? 'bad' : 'warn',
          h: over > D.length / 3 ? 'Частый перебор калорий' : 'Скачет калорийность',
          x: de ? `Nur ${pct(kIn)}% der Tage im Bereich ±10%, über dem Ziel an ${over} von ${D.length}.` : `В коридоре ±10% только ${pct(kIn)}% дней, перебор в ${over} из ${D.length}.`,
        },
  );
  const we = D.filter((d) => [0, 6].includes(wd(d.d)));
  const wk = D.filter((d) => ![0, 6].includes(wd(d.d)));
  if (we.length && wk.length) {
    const df = avg(we.map((d) => d.k)) - avg(wk.map((d) => d.k));
    if (df > t.k * 0.12)
      out.push({
        l: 'bad',
        h: 'Срывы на выходных',
        x: de ? `Am Wochenende im Schnitt ${Math.round(df)} kcal mehr als unter der Woche. Das frisst das Wochendefizit.` : `В выходные в среднем на ${Math.round(df)} ккал больше, чем в будни. Это съедает недельный дефицит.`,
      });
    else if (df < -t.k * 0.15)
      out.push({
        l: 'warn',
        h: 'Недоедание на выходных',
        x: de ? `Am Wochenende ${Math.round(-df)} kcal weniger. Vermutlich wird Essen vergessen oder nicht eingetragen.` : `В выходные на ${Math.round(-df)} ккал меньше. Похоже, клиент забывает есть или не записывает.`,
      });
  }
  const its = D.flatMap((d) => (d.items ?? []).map((i) => ({ ...i, d: d.d }))).filter((i) => i.ts);
  if (its.length) {
    const h = (i: { ts?: number }) => new Date(i.ts ?? 0).getHours();
    const kAll = its.reduce((a, i) => a + (i.kcal || 0), 0) || 1;
    const late = its.filter((i) => h(i) >= 21).reduce((a, i) => a + (i.kcal || 0), 0) / kAll;
    if (late > 0.2)
      out.push({ l: 'bad', h: 'Поздние приемы пищи', x: de ? `${pct(late)}% der Kalorien nach 21 Uhr. Oft Snacks vor dem Schlafen.` : `${pct(late)}% калорий приходится на время после 21:00. Часто это перекусы перед сном.` });
    const dd = D.filter((d) => (d.items ?? []).length);
    const noBf = dd.filter((d) => !(d.items ?? []).some((i) => i.ts && h(i) < 11)).length;
    if (dd.length && noBf / dd.length > 0.5)
      out.push({
        l: 'warn',
        h: 'Пропуск завтрака',
        x: de ? `An ${noBf} von ${dd.length} Tagen erste Mahlzeit nach 11 Uhr. Der Hunger staut sich bis zum Abend.` : `В ${noBf} из ${dd.length} дней первый прием пищи после 11:00. Голод копится к вечеру.`,
      });
    const sn = its.filter((i) => i.slot === 'snack');
    const snK = sn.reduce((a, i) => a + (i.kcal || 0), 0) / kAll;
    if (snK > 0.3)
      out.push({
        l: 'warn',
        h: 'Много перекусов',
        x: de ? `Snacks liefern ${pct(snK)}% der Kalorien. Besser durch vollwertige Mahlzeiten mit Eiweiß ersetzen.` : `Перекусы дают ${pct(snK)}% калорий. Стоит заменить их полноценными приемами пищи с белком.`,
      });
  }
  const miss = 14 - D.length;
  if (miss >= 3) out.push({ l: 'warn', h: 'Пропуски в дневнике', x: de ? `${miss} von 14 Tagen ohne Einträge. Daten unvollständig.` : `${miss} дней из 14 без записей. Данные неполные.` });
  const ak = avg(D.map((x) => x.k));
  const cv = Math.sqrt(avg(D.map((d) => (d.k - ak) ** 2))) / (ak || 1);
  if (cv > 0.18) out.push({ l: 'warn', h: 'Режим "густо-пусто"', x: de ? `Kalorien schwanken stark von Tag zu Tag (Streuung ${pct(cv)}%).` : `Калорийность сильно колеблется день ото дня (разброс ${pct(cv)}%).` });
  const w2 = (c.workouts ?? []).filter((w) => w.date > shiftIso(today, -14)).length / 2;
  const plan = p.act || 3;
  out.push(
    w2 >= plan * 0.8
      ? { l: 'good', h: 'Тренируется регулярно', x: de ? `Im Schnitt ${w2} pro Woche bei Plan ${plan}.` : `В среднем ${w2} в неделю при плане ${plan}.` }
      : { l: w2 < plan / 2 ? 'bad' : 'warn', h: 'Мало тренировок', x: de ? `Im Schnitt ${w2} pro Woche bei Plan ${plan}.` : `В среднем ${w2} в неделю при плане ${plan}.` },
  );
  const ms = (c.measures ?? []).filter((m) => m.w != null || m.weight != null);
  if (ms.length > 1) {
    const W = (m: { w?: number; weight?: number }) => (m.w ?? m.weight) as number;
    const f = ms[0]!, l = ms[ms.length - 1]!;
    const wks = Math.max(1, (Date.parse(l.date) - Date.parse(f.date)) / 6048e5);
    const r = (W(l) - W(f)) / wks;
    const need = p.goal === 'gain' ? 1 : p.goal === 'lose' ? -1 : 0;
    const ok = need ? Math.sign(r) === need && Math.abs(r) <= 1 : Math.abs(r) < 0.3;
    const g = tr(GOALN[p.goal ?? ''] ?? '');
    out.push({ l: ok ? 'good' : 'warn', h: ok ? 'Вес идет в нужную сторону' : 'Вес не по плану', x: de ? `${r > 0 ? '+' : ''}${Math.round(r * 10) / 10} kg pro Woche, Ziel: ${g}.` : `${r > 0 ? '+' : ''}${Math.round(r * 10) / 10} кг в неделю, цель: ${g}.` });
  }
  const ord = { bad: 0, warn: 1, good: 2 };
  return out.sort((x, y) => ord[x.l] - ord[y.l]);
}

/** mealFlag(): отметка блюда для тренера (алкоголь, фастфуд, > 40% нормы, мало белка, поздно). why: ключи перевода через запятую. */
export function mealFlag(i: { name?: string; kcal?: number; p?: number; ts?: number }, t: { k?: number } | null): { l: 'bad' | 'warn'; why: string } | null {
  const r: string[] = [];
  let lvl: 'bad' | 'warn' | null = null;
  const k = i.kcal || 0, p = i.p || 0, h = i.ts ? new Date(i.ts).getHours() : null, n = (i.name || '').toLowerCase();
  if (/пив|вин|водк|алког|bier|wein|коктейл/.test(n)) {
    r.push('алкоголь');
    lvl = 'bad';
  }
  if (/чипс|шоколад|конфет|торт|пицц|бургер|картошка фри|^фри|сникерс|печень|chips|schoko|pizza|кола|cola/.test(n)) {
    r.push('фастфуд или сладкое');
    lvl = lvl || 'warn';
  }
  if (t && t.k && k > t.k * 0.4) {
    r.push('больше 40% дневной нормы');
    lvl = 'bad';
  }
  if (k >= 250 && (p * 4) / k < 0.1) {
    r.push('мало белка');
    lvl = lvl || 'warn';
  }
  if (h != null && (h >= 22 || h < 5) && k >= 200) {
    r.push('поздно вечером');
    lvl = lvl === 'bad' || k >= 500 ? 'bad' : 'warn';
  }
  return lvl ? { l: lvl, why: r.join(', ') } : null;
}
