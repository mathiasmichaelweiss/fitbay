import { useTranslation } from 'react-i18next';
import { dayStats, expenditure, fatFromDeficit, groupMeals, proj, target, weightOn, type CalcProfile } from '@fitbay/calc';
import type { Meal } from '@fitbay/shared';
import { Tile } from '@/components/ui/tile';
import { shiftDay, today, useMealsRange, useProfile, useWeighings } from '@/data/hooks';
import { withTs } from '@/lib/meals';

/** Плитка «Жир сегодня» (renderFat прототипа): факт по дефициту, прогноз на месяц, «живой» прогноз в течение дня. */
export function FatTile({ date, meals }: { date: string; meals: Meal[] }) {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const { data: hist = [] } = useMealsRange(shiftDay(date, -60), date);
  const weights = useWeighings();
  if (!profile) return null;
  const p = profile as unknown as CalcProfile;
  const u = t('г');
  const all = [...hist.filter((m) => m.date !== date), ...meals];
  const pct = profile.actPct ?? 0.5;
  const D = dayStats(all, p, date, weights, {}, pct);
  const T0 = D.find((x) => x.d === date);
  const P = proj(D, today());
  const goal = target(p, date, { pct }).k;
  const eaten = T0?.eat ?? 0;
  const lastW = weights.map((w) => w.date).sort().at(-1);
  const stale = !lastW || (Date.parse(`${today()}T12:00:00`) - Date.parse(`${lastW}T12:00:00`)) / 864e5 > 7;
  const sign = (f: number) => `${f >= 0 ? '−' : '+'}${Math.round(Math.abs(f))}${u}`;

  // До ужина и пока съедено меньше 85% нормы показываем прогноз «если съешь норму».
  const live = date === today() && eaten < goal * 0.85 && new Date().getHours() < 21 && !groupMeals(meals.map(withTs), goal).some((g) => g.slot === 'dinner');
  if (live) {
    const w = weightOn(weights, date, p.w);
    const tdee = expenditure(p, date, { pct }, w);
    const pk = (T0?.prot ?? 0) / w;
    const fat = fatFromDeficit(tdee - goal, Math.max(pk, target(p, date, { pct }).p / w));
    return (
      <Tile
        color="cream"
        full
        dot={stale}
        label={`${t('ПРОГНОЗ НА СЕГОДНЯ')} ≈`}
        value={<span data-testid="fat-num">{sign(fat)}</span>}
        sub={`${eaten ? `${t('День только начался')}: ${Math.round((eaten / goal) * 100)}% ${t('нормы')}. ` : `${t('День только начался')}. `}${t('Столько уйдет, если съешь свою норму')}`}
      />
    );
  }
  const kg = i18n.language === 'de' ? 'kg' : 'кг';
  return (
    <Tile
      color="cream"
      full
      dot={stale}
      label={`${t(date === today() ? 'ЖИР СЕГОДНЯ' : 'ЖИР ЗА ДЕНЬ')} ≈`}
      value={<span data-testid="fat-num">{T0 ? sign(T0.fat) : `0${u}`}</span>}
      sub={stale ? t('Пора взвеситься') : P ? `${t('прогноз за месяц')} ${P.month >= 0 ? '−' : '+'}${Math.abs(P.month).toFixed(1).replace('.', ',')} ${kg}` : t('примерный расчет')}
    />
  );
}
