import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import type { Meal } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { FoodIcon } from '@/components/ui/food-icons';
import { CapsRings, RC } from '@/components/ui/rings';
import { Tile, Tiles } from '@/components/ui/tile';
import { useQueryClient } from '@tanstack/react-query';
import { dayType, flexOf, mealsKey, type CalcProfile } from '@fitbay/calc';
import { api, ApiError } from '@/data/api';
import { shiftDay, today, useCoach, useDaySummary, useMealOps, useProfile, useSaveProfile } from '@/data/hooks';
import { FatTile } from './FatTile';
import { TrendSheet } from './TrendSheet';
import { MsRemindTile } from './Measures';
import { TipTile } from './trainer/Tiles';
import { PlanTile } from './plan/Path';
import { groupMeals, SLOTN, withTs } from '@/lib/meals';
import { CheckinTile } from './Checkin';
import { AddFood } from './food/AddFood';
import { QuickDay } from './food/QuickDay';

/** Экран питания: порт сетки #nutri прототипа (плитки, круги, коуч, «Съедено»). */
export function Today({ date }: { date: string }) {
  const { t, i18n } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [quick, setQuick] = useState(false);
  const [trend, setTrend] = useState(false);
  const { target: tg, eaten: s, meals } = useDaySummary(date);
  const { remove } = useMealOps();
  const { data: saved } = useCoach(date);
  const { data: profile } = useProfile();
  const saveProfile = useSaveProfile();
  const fx = profile ? flexOf(profile as unknown as CalcProfile) : null;
  const dt = fx && profile ? dayType(date, profile as unknown as CalcProfile, fx) : null;
  /** #dtChip прототипа: переключить тип дня вручную, старые отметки (больше 30 дней) чистятся. */
  const toggleDay = () => {
    if (!profile || !dt) return;
    const ov = Object.fromEntries(Object.entries(profile.dayOv ?? {}).filter(([k]) => k >= shiftDay(today(), -30)));
    ov[date] = dt === 'train' ? 'rest' : 'train';
    saveProfile.mutate({ ...profile, dayOv: ov });
  };
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [coachErr, setCoachErr] = useState('');
  const [coachInfo, setCoachInfo] = useState('');
  const loc = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const g = t('г');
  const past = date < today();
  if (!tg) return null;

  const pl = tg.p - s.p;
  const kl = tg.k - s.k;
  const fallback = !meals.length
    ? t('День чистый. Начни с белкового завтрака, так проще закрыть средний круг.')
    : s.k > tg.k * 1.05
      ? i18n.language === 'de'
        ? `Kalorien schon ${s.k - tg.k} über dem Ziel. Kein Drama, ab jetzt einfach leichter.`
        : `Калории уже выше нормы на ${s.k - tg.k}. Ничего страшного, просто дальше полегче.`
      : pl > 0
        ? i18n.language === 'de'
          ? `Noch ${pl}g Eiweiß bis zum Ziel. ${Math.max(0, kl)} kcal übrig, das reicht.`
          : `${pl}г белка до цели. Осталось ${Math.max(0, kl)} ккал, этого хватит.`
        : kl > 0
          ? i18n.language === 'de'
            ? `Eiweiß geschafft. Noch ${kl} kcal bis zum Bedarf.`
            : `Белок закрыт. Еще ${kl} ккал до нормы.`
          : t('Все круги закрыты. Отличный день.');
  const coach = asking ? t('Коуч думает...') : (saved?.text ?? fallback);
  const loc2 = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const coachMeta = coachErr || coachInfo || (saved ? `${i18n.language === 'de' ? 'Stand ' : 'Совет от '}${new Date(saved.at).toLocaleTimeString(loc2, { hour: '2-digit', minute: '2-digit' })}${saved.key !== mealsKey(meals) ? (i18n.language === 'de' ? ', seitdem neue Einträge' : ', после него были новые записи') : ''}` : '');

  /** $("askCoach").onclick прототипа: только сегодня и только если есть еда. */
  const askCoach = async () => {
    if (past || !meals.length) return;
    setAsking(true);
    setCoachErr('');
    setCoachInfo('');
    try {
      const now = new Date();
      const r = await api.call<{ text: string; cached?: boolean }>('POST', '/ai/coach', { day: date, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, lang: i18n.language });
      await qc.invalidateQueries({ queryKey: ['coach', date] });
      if (r.cached) setCoachInfo(t('Совет актуален. Новый появится после следующего приема пищи.'));
    } catch (e) {
      setCoachErr(e instanceof ApiError && (e.status === 429 || e.status === 503) ? t(e.message) : i18n.language === 'de' ? 'Coach hat gerade nicht geantwortet.' : 'Коуч сейчас не ответил, попробуй еще раз.');
    } finally {
      setAsking(false);
    }
  };

  const legend: [string, number, number, string, string][] = [
    ['Калории', s.k, tg.k, '', RC.k],
    ['Белок', s.p, tg.p, g, RC.p],
    ['Углеводы', s.c, tg.c, g, RC.c],
    ['Жиры', s.f, tg.f, g, RC.f],
  ];
  const groups = groupMeals(meals.map(withTs), tg.k);

  return (
    <Tiles>
      <Tile
        color="orange"
        full
        chevron
        label={t('КАЛОРИИ ЗА ДЕНЬ')}
        value={<span data-testid="kcal-eaten">{s.k.toLocaleString(loc)}</span>}
        sub={
          <>
            {t('из')}{' '}
            <span data-testid="kcal-target">
              {tg.bonus ? `${tg.base.toLocaleString(loc)} + ${tg.bonus.toLocaleString(loc)} ${t('за активность')}` : tg.k.toLocaleString(loc)}
            </span>
          </>
        }
      >
        {dt && (
          <button type="button" data-testid="day-type" onClick={toggleDay} className="absolute right-[52px] top-3.5 rounded-full bg-black/18 px-2.5 py-1 text-[0.72rem] font-bold">
            {dt === 'train' ? `🏋️ ${t('Тренировочный день')}` : `🛋 ${t('День отдыха')}`}
          </button>
        )}
      </Tile>
      <Tile color="cream" label={t('БЕЛОК')} small value={`${s.p}${g}`} sub={`${t('из')} ${tg.p}${g}`} />
      <Tile
        color="yellow"
        dot={!past}
        title={t('Добавить еду')}
        sub={t(past ? 'День закрыт' : 'Фото, посуда, описание')}
        onClick={() => setAdding(true)}
        disabled={past}
        data-testid="add-food"
      />

      <CheckinTile />
      {date === today() && <MsRemindTile />}
      <PlanTile />
      <TipTile cat="food" />

      <div className="col-span-full rounded-xl bg-card p-4">
        <span className="text-[0.68rem] font-semibold tracking-[0.06em] text-muted-foreground">{t('КРУГИ ПИТАНИЯ')}</span>
        <div className="mt-3 flex items-center gap-4">
          <CapsRings size={132} items={[{ v: s.k, g: tg.k, c: RC.k }, { v: s.p, g: tg.p, c: RC.p }, { v: s.c, g: tg.c, c: RC.c }, { v: s.f, g: tg.f, c: RC.f }]} label={t('КРУГИ ПИТАНИЯ')} />
          <div className="grid gap-2 text-[0.9rem]">
            {legend.map(([n, v, goal, u, col]) => (
              <div key={n}>
                <b className="block text-[1.15rem] font-semibold tabular-nums" style={{ color: col }}>
                  {v}
                  {u} / {goal}
                  {u}
                </b>
                <span className="text-[0.78rem] text-muted-foreground">{t(n)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FatTile date={date} meals={meals} onOpen={() => setTrend(true)} />

      <div className="relative col-span-full flex flex-col rounded-xl bg-brand-teal p-4 text-on-color">
        <span className="text-[1.1rem] font-semibold">»</span>
        <span className="absolute right-3.5 top-3.5 rounded-full bg-black/10 px-2.5 py-0.5 text-[0.7rem] font-semibold">{t('AI-коуч')}</span>
        <div className="mt-3.5 text-[1.15rem] font-medium leading-[1.3]" data-testid="coach">
          {coach}
        </div>
        <Button disabled={past || asking || !meals.length} onClick={askCoach} className="mt-3.5 h-auto self-start rounded-full bg-[#111] px-4 py-2.5 text-[0.9rem] text-white hover:bg-[#111]/90">
          {t(saved ? 'Обновить совет' : 'Спросить коуча')}
        </Button>
        {coachMeta && <div className="mt-1.5 text-[0.75rem] opacity-55" data-testid="coach-meta">{coachMeta}</div>}
      </div>

      <div className="col-span-full rounded-xl bg-brand-peach p-4 text-on-color">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] opacity-75">{t('СЪЕДЕНО')}</span>
        {groups.length > 0 && !past && <div className="mt-0.5 text-[0.75rem] opacity-60">{t('Нажми на блюдо, чтобы изменить')}</div>}
        {groups.length === 0 ? (
          <div className="mt-2 text-[0.85rem] opacity-60">{t('Пока пусто')}</div>
        ) : (
          groups.map((gr) => (
            <div key={`${gr.slot}${gr.first}`}>
              <div className="mb-1.5 mt-3.5 flex items-baseline justify-between text-[0.8rem] uppercase tracking-[0.06em] opacity-65">
                <span>
                  {t(SLOTN[gr.slot])}
                  {gr.first ? ` · ${new Date(gr.first).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
                <span>{gr.kcal} kcal</span>
              </div>
              {gr.items.map((m) => (
                <div key={m.id} data-testid="row" className="flex items-center gap-3 border-t border-black/12 py-2.5 first-of-type:border-t-0">
                  <FoodIcon name={m.name} thumb={m.thumb} />
                  <button
                    type="button"
                    disabled={past}
                    aria-label={`${t('Изменить блюдо')}: ${m.name}`}
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setEditing(meals.find((x) => x.id === m.id) ?? null)}
                  >
                    <div className="truncate font-semibold">{m.name}</div>
                    <div className="text-[0.8rem] opacity-65">
                      {i18n.language === 'de' ? `E ${m.protein} · F ${m.fat} · KH ${m.carbs}` : `Б ${m.protein} · Ж ${m.fat} · У ${m.carbs}`}
                    </div>
                  </button>
                  <div className="font-semibold tabular-nums">{m.kcal}</div>
                  {!past && (
                    <button type="button" className="grid size-11 place-items-center opacity-50" aria-label={`${t('Удалить')}: ${m.name}`} onClick={() => remove.mutate(m.id)}>
                      <XIcon className="size-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <AddFood date={date} open={adding || !!editing} edit={editing} onClose={() => (setAdding(false), setEditing(null))} onQuickDay={() => setQuick(true)} />
      <QuickDay date={date} open={quick} onClose={() => setQuick(false)} />
      <TrendSheet open={trend} onClose={() => setTrend(false)} date={date} meals={meals} />
    </Tiles>
  );
}
