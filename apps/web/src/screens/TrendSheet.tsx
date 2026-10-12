import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { dayStats, proj, weightAnalyze, WEIGHT_TEXT, type CalcProfile, type DayStat, type WeightPoint } from '@fitbay/calc';
import type { Meal } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SingleToggle } from '@/components/ui/toggle-group';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { shiftDay, today, useActKcalByDay, useMeasureOps, useMeasures, useMealsRange, useProfile, useSaveProfile, useWeighings, useWorkouts } from '@/data/hooks';

const GREEN = '#7BC67B';
const c1 = (n: number) => n.toFixed(1).replace('.', ',');
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 864e5);

/** sh-trend прототипа «Жир и тенденция»: вес, сегодня, прогноз, дефицит по дням, вес и прогноз (renderTrend). */
export function TrendSheet({ open, onClose, date, meals }: { open: boolean; onClose: () => void; date: string; meals: Meal[] }) {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const { data: hist = [] } = useMealsRange(shiftDay(today(), -60), today());
  const weights = useWeighings();
  const [insight, setInsight] = useState<{ prev: WeightPoint; w: number; date: string } | null>(null);
  const actBy = useActKcalByDay();
  if (!profile) return null;
  const p = profile as unknown as CalcProfile;
  const all = [...hist.filter((m) => m.date !== date), ...meals];
  const D = dayStats(all, p, date, weights, actBy, profile.actPct ?? 0.5);
  const T0 = D.find((x) => x.d === date);
  const P = proj(D, today());
  const f = (n: number) => Math.round(n).toLocaleString(i18n.language);
  const u = t('кг');
  const g = t('г');
  const locale = i18n.language === 'de' ? de : ru;
  const dayLabel = date === today() ? t('Сегодня') : format(parseISO(date), 'd MMMM', { locale });
  const firstMeal = hist.map((m) => m.date).sort()[0];
  const wStart = (): WeightPoint => ({ w: +profile.w, date: firstMeal || shiftDay(today(), -7), start: true });

  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Жир и тенденция')}>
      <div className="grid gap-3">
        <WeighCard
          weights={weights}
          onWhy={() => {
            const l = weights.at(-1);
            if (!l) return;
            const pr = weights.length > 1 ? weights.at(-2) : undefined;
            setInsight({ prev: pr ? { w: pr.w, date: pr.date } : wStart(), w: l.w, date: l.date });
          }}
          onSaved={(prev, w) => setInsight({ prev: prev ?? wStart(), w, date: today() })}
        />

        <Card className="gap-0" data-testid="tr-today">
          <span className="text-sm text-muted-foreground">{dayLabel}</span>
          {T0 ? (
            <>
              <div className="text-[2.4rem] font-bold" style={{ color: T0.fat < 0 ? 'var(--orange)' : GREEN }}>
                ≈{T0.fat >= 0 ? '−' : '+'}
                {Math.round(Math.abs(T0.fat))} {g} {t('жира')}
              </div>
              <div className="text-[0.88rem] leading-normal opacity-75">
                {t('Расход')} ≈ {f(T0.tdee)} {t('ккал')}, {t('съедено')} {f(T0.eat)}. {T0.def >= 0 ? t('Дефицит') : t('Профицит')} {f(Math.abs(T0.def))} {t('ккал')}.
                {T0.d === today() ? ` ${t('День еще идет, цифра изменится.')}` : ''}
              </div>
              {T0.def > 0 && (
                <div className={cn('mt-2.5 rounded-[14px] px-3 py-2.5 text-[0.86rem] leading-snug', T0.pk < 1.6 ? 'bg-[rgba(255,90,10,.15)]' : 'bg-[rgba(123,198,123,.15)]')}>
                  {t('Белок')} {Math.round(T0.prot)} {g} ({T0.pk.toFixed(1).replace('.', ',')} {t('г на кг веса')}).{' '}
                  {T0.pk < 1.6
                    ? `${t('Белка мало, поэтому примерно')} ${Math.round(T0.ls * 100)}% ${t('потери может прийти из мышц, а не из жира. Цифра жира выше уже это учитывает.')}`
                    : t('Белка достаточно, мышцы защищены, худеешь в основном за счет жира.')}
                </div>
              )}
            </>
          ) : (
            <div className="opacity-60">{t('Сегодня пока нет записей.')}</div>
          )}
        </Card>

        <Card className="gap-0" data-testid="tr-proj">
          {P ? (
            <>
              <span className="text-sm text-muted-foreground">{t('Если продолжишь так же')}</span>
              <div className="text-[1.05rem] leading-normal">
                {t('Средний дефицит')} {f(P.avg)} {t('ккал в день')} ({P.n} {t('дн.')}). {t('Через месяц примерно')}{' '}
                <b>
                  {P.month >= 0 ? '−' : '+'}
                  {c1(Math.abs(P.month))} {u}
                </b>
                , {t('то есть около')}{' '}
                <b>
                  {c1(profile.w - P.month)} {u}
                </b>
                .
              </div>
            </>
          ) : (
            <div className="opacity-60">{t('Нужно хотя бы несколько дней записей для прогноза.')}</div>
          )}
        </Card>

        <Card className="gap-0">
          <span className="text-sm text-muted-foreground">{t('Дефицит по дням, ккал')}</span>
          <Bars B={D.slice(-14)} />
        </Card>

        <Card className="gap-0">
          <span className="text-sm text-muted-foreground">{t('Вес и прогноз')}</span>
          <WeightChart weights={weights} P={P} w={profile.w} tw={profile.tw} />
        </Card>

        <p className="text-[0.78rem] leading-[1.45] text-muted-foreground">
          {t(
            'Это примерный расчет: расход энергии считается по формуле Миффлина по твоему весу, росту, возрасту и числу тренировок, а сожженный жир как дефицит калорий, деленный на 7700 ккал на кг, с поправкой на белок: чем меньше белка на кг веса, тем большая доля потери считается мышечной (от 10% при 2 г/кг и выше до 35% при 0,8 г/кг и ниже). Дни без записей не учитываются. Вес на весах дополнительно колеблется из-за воды, соли и углеводов, поэтому сравнивай средние значения за неделю.',
          )}
        </p>
      </div>
      <WeightInsight data={insight} D={D} firstMeal={firstMeal} onClose={() => setInsight(null)} />
    </SheetPage>
  );
}

/** trWeigh: карточка веса с напоминанием раз в неделю. */
function WeighCard({ weights, onWhy, onSaved }: { weights: { date: string; w: number }[]; onWhy: () => void; onSaved: (prev: WeightPoint | null, w: number) => void }) {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const { data: measures = [] } = useMeasures();
  const { update } = useMeasureOps();
  const save = useSaveProfile();
  const [v, setV] = useState('');
  const locale = i18n.language === 'de' ? de : ru;
  const last = weights.at(-1);
  const ld = last ? daysBetween(last.date, today()) : 999;
  const submit = async () => {
    const n = parseFloat(v.replace(',', '.'));
    if (!(n > 30 && n < 300) || !profile) return;
    const before = weights.filter((x) => x.date < today()).at(-1);
    const ex = measures.find((m) => m.date === today());
    try {
      await update.mutateAsync({ ...(ex ?? {}), id: today(), date: today(), weight: n });
      await save.mutateAsync({ ...profile, w: n });
      setV('');
      onSaved(before ? { w: before.w, date: before.date } : null, n);
    } catch {
      /* как в прототипе: молча */
    }
  };
  return (
    <Card className={cn('gap-0', ld > 7 && 'border border-brand-orange')} data-testid="tr-weigh">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{ld > 7 ? `⚖ ${t('Пора взвеситься')}` : t('Вес')}</span>
        {weights.length > 0 && (
          <button type="button" onClick={onWhy} className="min-h-9 text-[0.78rem] font-semibold text-brand-teal">
            {t('Почему вес изменился?')}
          </button>
        )}
      </div>
      <div className="mb-2 text-[0.85rem] opacity-70">
        {ld >= 999
          ? t('Ты еще ни разу не записывал вес. От него зависит расход энергии в расчете.')
          : `${t('Последнее взвешивание')}: ${format(parseISO(last!.date), 'd MMMM', { locale })}${ld > 7 ? `. ${t('Взвешивайся раз в неделю, утром натощак, чтобы прогноз был точнее.')}` : ''}`}
      </div>
      <div className="flex gap-2">
        <Input type="number" inputMode="decimal" step="0.1" aria-label={t('Вес')} placeholder={String(profile?.w ?? '')} value={v} onChange={(e) => setV(e.target.value)} className="flex-1" />
        <Button className="h-[46px] px-[18px]" onClick={submit} disabled={update.isPending}>
          {t('Записать')}
        </Button>
      </div>
    </Card>
  );
}

/** trBars: дефицит последних 14 дней, нажатие показывает цифры дня. */
function Bars({ B }: { B: DayStat[] }) {
  const { t, i18n } = useTranslation();
  const [sel, setSel] = useState<number | null>(null);
  const f = (n: number) => Math.round(n).toLocaleString(i18n.language);
  const locale = i18n.language === 'de' ? de : ru;
  if (!B.length) return <div className="opacity-60">{t('Нет данных.')}</div>;
  const W = 320, H = 150, mx = Math.max(300, ...B.map((x) => Math.abs(x.def))), bw = W / Math.max(B.length, 7), mid = H / 2;
  const x = sel != null ? B[sel] : undefined;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img" aria-label={t('Дефицит по дням, ккал')} data-testid="tr-bars">
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="#444" />
        {B.map((d, i) => {
          const h = (Math.abs(d.def) / mx) * (mid - 8);
          return (
            <g key={d.d}>
              <rect
                data-bar={i}
                className="cursor-pointer"
                onClick={() => setSel(i)}
                x={i * bw + bw * 0.18}
                y={d.def >= 0 ? mid - h : mid}
                width={bw * 0.64}
                height={Math.max(1, h)}
                rx="3"
                fill={d.def >= 0 ? GREEN : '#FF5A0A'}
                opacity={d.d === today() ? 0.55 : 1}
                stroke={sel === i ? '#fff' : 'none'}
              >
                <title>{`${d.d}: ${Math.round(d.def)}`}</title>
              </rect>
              <text x={i * bw + bw / 2} y={H + 14} fontSize="9" fill="#888" textAnchor="middle">
                {+d.d.slice(8)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mb-2 mt-1.5 min-h-11 rounded-[14px] bg-[#1f1f1f] px-3 py-2.5 text-[0.88rem] leading-snug" data-testid="bar-info">
        {x ? (
          <>
            <b className="capitalize">{format(parseISO(x.d), 'EEE, d MMMM', { locale })}</b>:{' '}
            <b style={{ color: x.def >= 0 ? GREEN : 'var(--orange)' }}>
              {x.def >= 0 ? t('дефицит') : t('профицит')} {f(Math.abs(x.def))} {t('ккал')}
            </b>
            <div className="mt-0.5 text-[0.8rem] text-muted-foreground">
              {t('Съедено')} {f(x.eat)} · {t('Расход')} ≈ {f(x.tdee)}
            </div>
          </>
        ) : (
          t('Нажми на столбик, чтобы увидеть цифры за день.')
        )}
      </div>
      <div className="text-[0.75rem] opacity-60">{t('Зеленый: дефицит, оранжевый: профицит.')}</div>
    </>
  );
}

const RANGES: [string, string][] = [['7', 'Неделя'], ['30', 'Месяц'], ['90', '3 мес'], ['365', 'Год'], ['0', 'Всё']];
const plural = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? 'взвешивание' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'взвешивания' : 'взвешиваний';

/** renderWeightChart: взвешивания, среднее за 7 дней, прогноз, цель; диапазоны и подпись по точке. */
function WeightChart({ weights, P, w, tw }: { weights: { date: string; w: number }[]; P: { month: number } | null; w: number; tw?: number }) {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState(30);
  const [sel, setSel] = useState<number | null>(null);
  const locale = i18n.language === 'de' ? de : ru;
  const W = 320, H = 170, td = today();
  const allW = weights.map((x) => ({ d: x.date, w: +x.w })).sort((a, b) => (a.d < b.d ? -1 : 1));
  const from = range ? shiftDay(td, -range) : (allW[0]?.d ?? shiftDay(td, -30));
  let pts = allW.filter((x) => x.d >= from && x.d <= td);
  const before = allW.filter((x) => x.d < from).slice(-1);
  if (!pts.length && !allW.length) pts = [{ d: td, w: +w }];
  const projDays = range === 7 ? 7 : 30;
  const lastAll = allW.at(-1) ?? { d: td, w: +w };
  const showProj = !!P && (range === 0 || range >= 7);
  const end = showProj ? { d: shiftDay(td, projDays), w: lastAll.w - ((P?.month || 0) * projDays) / 30 } : null;
  const t0 = Date.parse(`${from}T12:00:00`), t1 = Date.parse(`${end ? end.d : td}T12:00:00`);
  const seq = [...before, ...pts];
  const ws = [...seq.map((x) => x.w), ...(end ? [end.w] : []), ...(pts.length ? [] : [lastAll.w])];
  const lo = Math.floor(Math.min(...ws) - 0.6), hi = Math.ceil(Math.max(...ws) + 0.6);
  const X = (d: string) => Math.max(30, Math.min(W - 8, 30 + ((Date.parse(`${d}T12:00:00`) - t0) / Math.max(1, t1 - t0)) * (W - 40)));
  const Y = (v: number) => 10 + ((hi - v) / Math.max(0.1, hi - lo)) * (H - 24);
  const ma =
    pts.length >= 4
      ? pts.map((p) => {
          const s0 = Date.parse(`${p.d}T12:00:00`) - 6 * 864e5;
          const win = pts.filter((q) => Date.parse(`${q.d}T12:00:00`) >= s0 && q.d <= p.d);
          return { d: p.d, w: win.reduce((a, q) => a + q.w, 0) / win.length };
        })
      : [];
  const fmtS = (d: string) => format(parseISO(d), range >= 365 || range === 0 ? 'LLL yy' : 'd MMM', { locale });
  const mid = new Date((t0 + t1) / 2).toISOString().slice(0, 10);
  const grid = [lo, (lo + hi) / 2, hi];
  const ch = pts.length >= 2 ? pts.at(-1)!.w - pts[0]!.w : null;
  const kg = t('кг');
  const sp = sel != null ? pts[sel] : undefined;
  return (
    <>
      <SingleToggle
        className="mb-2 mt-1 flex-nowrap gap-1 overflow-x-auto text-xs"
        aria-label={t('Период')}
        value={String(range)}
        onChange={(k) => (setRange(+k), setSel(null))}
        options={RANGES.map(([k, l]) => ({ value: k, label: t(l) }))}
      />
      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img" aria-label={t('Вес и прогноз')} data-testid="w-chart">
        {grid.map((v) => (
          <g key={v}>
            <line x1="30" x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="#262626" />
            <text x="2" y={Y(v) + 3} fontSize="9" fill="#777">
              {String(Math.round(v * 10) / 10).replace('.', ',')}
            </text>
          </g>
        ))}
        {tw ? <line x1="30" x2={W - 6} y1={Y(tw)} y2={Y(tw)} stroke={GREEN} strokeDasharray="2 4" opacity={tw >= lo && tw <= hi ? 0.8 : 0} /> : null}
        {seq.length > 1 && <polyline fill="none" stroke="#F3EFE7" strokeWidth="2" strokeLinejoin="round" opacity=".9" points={seq.map((x) => `${X(x.d)},${Y(x.w)}`).join(' ')} />}
        {ma.length > 1 && <polyline fill="none" stroke="#AFD9DA" strokeWidth="3" strokeLinejoin="round" opacity=".85" points={ma.map((x) => `${X(x.d)},${Y(x.w)}`).join(' ')} />}
        {end && (
          <>
            <line x1={X(lastAll.d >= from ? lastAll.d : from)} y1={Y(lastAll.w)} x2={X(end.d)} y2={Y(end.w)} stroke="#FF5A0A" strokeWidth="2" strokeDasharray="6 5" />
            <circle cx={X(end.d)} cy={Y(end.w)} r="4" fill="#FF5A0A" />
            <text x={X(end.d)} y={Y(end.w) - 8} fontSize="10" fill="#FF5A0A" textAnchor="end">
              {c1(end.w)}
            </text>
          </>
        )}
        {pts.map((x, i) => (
          <circle key={x.d} data-wp={i} className="cursor-pointer" onClick={() => setSel(i)} cx={X(x.d)} cy={Y(x.w)} r={pts.length > 40 ? 2.5 : 4.5} fill={sel === i ? 'var(--orange)' : '#F3EFE7'} />
        ))}
        <text x="30" y={H + 14} fontSize="9" fill="#888">
          {fmtS(from)}
        </text>
        <text x={(30 + W - 8) / 2} y={H + 14} fontSize="9" fill="#888" textAnchor="middle">
          {fmtS(mid)}
        </text>
        <text x={W - 8} y={H + 14} fontSize="9" fill="#888" textAnchor="end">
          {fmtS(end ? end.d : td)}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[0.74rem] text-muted-foreground">
        <span>
          <i className="mr-1 inline-block h-0.5 w-3 bg-[#F3EFE7] align-[3px]" />
          {t('взвешивания')}
        </span>
        {ma.length > 1 && (
          <span>
            <i className="mr-1 inline-block h-[3px] w-3 bg-[#AFD9DA] align-[3px]" />
            {t('среднее за 7 дней')}
          </span>
        )}
        {end && (
          <span>
            <i className="mr-1 inline-block w-3 border-t-2 border-dashed border-[#FF5A0A] align-[3px]" />
            {t('прогноз')} {projDays} {t('дн.')}
          </span>
        )}
        <span>
          <i className="mr-1 inline-block w-3 border-t-2 border-dotted border-[#7BC67B] align-[3px]" />
          {t('цель')}
        </span>
      </div>
      <div className="mt-1.5 min-h-5 text-[0.84rem]" data-testid="w-info">
        {sp ? (
          <>
            <b className="capitalize">{format(parseISO(sp.d), 'EEE, d MMMM yyyy', { locale })}</b>:{' '}
            <b>
              {c1(sp.w)} {kg}
            </b>
          </>
        ) : pts.length ? (
          ch != null ? (
            <>
              {t('За период')}:{' '}
              <b style={{ color: ch <= 0 ? GREEN : 'var(--orange)' }}>
                {ch > 0 ? '+' : ch < 0 ? '−' : ''}
                {c1(Math.abs(ch))} {kg}
              </b>{' '}
              · {pts.length} {t(plural(pts.length))}
            </>
          ) : (
            t('За период одно взвешивание')
          )
        ) : (
          <span className="text-muted-foreground">
            {t('В этом периоде взвешиваний нет. Последнее')}: {c1(lastAll.w)} {kg}
          </span>
        )}
      </div>
    </>
  );
}

/** showWeightInsight (sh-help2): раскладка изменения веса на жир, мышцы, сухую массу и воду. */
function WeightInsight({ data, D, firstMeal, onClose }: { data: { prev: WeightPoint; w: number; date: string } | null; D: DayStat[]; firstMeal?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: workouts = [] } = useWorkouts();
  if (!data) return null;
  const r = weightAnalyze(D, data.prev, data.w, data.date, workouts.map((w) => w.date), firstMeal);
  const [title, body] = WEIGHT_TEXT[r.kind];
  const kg = t('кг');
  const k = (n: number) => `${Math.abs(n) < 0.05 ? '0' : (n > 0 ? '+' : '−') + Math.abs(n).toFixed(Math.abs(n) < 1 ? 2 : 1).replace('.', ',')} ${kg}`;
  const ks = (n: number) => (n > 0 ? '+' : '−') + Math.abs(n).toFixed(Math.abs(n) < 1 ? 2 : 1).replace('.', ',');
  const f = (n: number) => Math.round(Math.abs(n)).toLocaleString(i18n.language);
  const segs = (
    [
      [t('Жир'), r.fat, 'var(--orange)'],
      [t('Мышцы'), r.muscle, GREEN],
      [t('Сухая масса'), r.kind.startsWith('surplus') ? 0 : r.lean, '#9a9a9a'],
      [t('Вода и гликоген'), r.water, 'var(--teal)'],
    ] as [string, number, string][]
  ).filter((x) => Math.abs(x[1]) >= 0.05);
  const tot = segs.reduce((a, x) => a + Math.abs(x[1]), 0) || 1;
  const base = `${t('За')} ${r.days} ${t('дн.')} ${r.def >= 0 ? t('дефицит') : t('профицит')} ${t('около')} ${f(r.def)} ${t('ккал')}${r.logged < r.days ? ` (${t('записано дней')}: ${r.logged} ${t('из')} ${r.days})` : ''}. ${t('Это примерно')} ${k(r.fat)} ${t('жира')}.`;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent data-testid="w-insight">
        <div className="px-5 pb-6">
          <div className="text-[0.8rem] text-muted-foreground">
            {c1(data.prev.w)} → {c1(data.w)} {kg} · {r.days} {t('дн.')}
          </div>
          <div className="text-[2.6rem] font-extrabold leading-[1.1]" style={{ color: r.diff <= 0 ? GREEN : 'var(--orange)' }}>
            {ks(r.diff)} {kg}
          </div>
          <DrawerTitle className="mt-1.5 text-[1.25rem]">{t(title)}</DrawerTitle>
          <div className="my-3.5 mb-2 flex h-4 overflow-hidden rounded-lg bg-[#262626]">
            {segs.map((x) => (
              <span key={x[0]} style={{ width: `${(Math.abs(x[1]) / tot) * 100}%`, background: x[2] }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-[0.82rem]">
            {segs.map((x) => (
              <span key={x[0]}>
                <i className="mr-1.5 inline-block size-2.5 rounded-[3px]" style={{ background: x[2] }} />
                {x[0]} {ks(x[1])}
              </span>
            ))}
          </div>
          <p className="mb-1.5 mt-3.5 text-[0.92rem] leading-[1.55] text-[#ddd]">{t(body)}</p>
          <p className="m-0 text-[0.82rem] leading-normal text-muted-foreground">
            {base} {r.pk ? `${t('Белок в среднем')} ${r.pk.toFixed(1).replace('.', ',')} ${t('г/кг')}${r.wo ? `, ${t('тренировок')}: ${r.wo}` : ''}.` : ''}
          </p>
          <div className="mt-3 rounded-[12px] bg-[#1f1f1f] px-3 py-2.5 text-[0.78rem] leading-[1.45] text-muted-foreground">
            💡 {t('Вес за день может гулять на 0,5-1,5 кг из-за воды. Взвешивайся утром, после туалета, до еды и смотри на тренд за неделю. Оценка приблизительная.')}
          </div>
          <Button className="mt-4 w-full" onClick={onClose}>
            {t('Понятно')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
