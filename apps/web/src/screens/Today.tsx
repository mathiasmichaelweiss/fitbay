import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import { type Meal } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { CapsRings, RC } from '@/components/ui/rings';
import { Tile, Tiles } from '@/components/ui/tile';
import { today, useDaySummary, useMealOps } from '@/data/hooks';
import { groupMeals, SLOTN, withTs } from '@/lib/meals';
import { CheckinTile } from './Checkin';

/** Экран питания: порт сетки #nutri прототипа (плитки, круги, коуч, «Съедено»). */
export function Today({ date }: { date: string }) {
  const { t, i18n } = useTranslation();
  const [adding, setAdding] = useState(false);
  const { target: tg, eaten: s, meals } = useDaySummary(date);
  const { remove } = useMealOps();
  const loc = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const g = t('г');
  const past = date < today();
  if (!tg) return null;

  const pl = tg.p - s.p;
  const kl = tg.k - s.k;
  const coach = !meals.length
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
      />
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

      <div className="relative col-span-full flex flex-col rounded-xl bg-brand-teal p-4 text-on-color">
        <span className="text-[1.1rem] font-semibold">»</span>
        <span className="absolute right-3.5 top-3.5 rounded-full bg-black/10 px-2.5 py-0.5 text-[0.7rem] font-semibold">{t('AI-коуч')}</span>
        <div className="mt-3.5 text-[1.15rem] font-medium leading-[1.3]" data-testid="coach">
          {coach}
        </div>
        <Button disabled className="mt-3.5 h-auto self-start rounded-full bg-[#111] px-4 py-2.5 text-[0.9rem] text-white hover:bg-[#111]">
          {t('Спросить коуча')}
        </Button>
      </div>

      <div className="col-span-full rounded-xl bg-brand-peach p-4 text-on-color">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] opacity-75">{t('СЪЕДЕНО')}</span>
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
                  <span className="grid size-12 flex-none place-items-center rounded-xl bg-black/8 text-xl" aria-hidden>
                    🍽
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{m.name}</div>
                    <div className="text-[0.8rem] opacity-65">
                      {i18n.language === 'de' ? `E ${m.protein} · F ${m.fat} · KH ${m.carbs}` : `Б ${m.protein} · Ж ${m.fat} · У ${m.carbs}`}
                    </div>
                  </div>
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

      <AddFood date={date} open={adding} onClose={() => setAdding(false)} />
    </Tiles>
  );
}

/**
 * Временный ручной ввод (часть «Добавить еду» прототипа: название + КБЖУ, поле .g4).
 * Фото, посуда, описание и «Мои блюда» переносятся следующим шагом вместе с ИИ-прокси.
 */
function AddFood({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { create } = useMealOps();
  const [f, setF] = useState({ name: '', k: '', p: '', f: '', c: '' });
  const n = (v: string) => Math.max(0, Math.round(Number(v.replace(',', '.')) || 0));
  const valid = f.name.trim() !== '' && n(f.k) > 0;
  const submit = () => {
    const meal: Partial<Meal> & { date: string } = { date, name: f.name.trim(), kcal: n(f.k), protein: n(f.p), fat: n(f.f), carbs: n(f.c) };
    create.mutate(meal, {
      onSuccess: () => {
        setF({ name: '', k: '', p: '', f: '', c: '' });
        onClose();
      },
    });
  };
  const box = (k: keyof typeof f, label: string) => (
    <Field label={label} value={f[k]} inputMode="numeric" className="[&_input]:text-center" onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
  );

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('Добавить еду')}</DrawerTitle>
        </DrawerHeader>
        <div className="grid gap-3">
          <Field label={t('Название')} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
          <div className="grid grid-cols-4 gap-1.5">
            {box('k', t('ккал'))}
            {box('p', t('белки'))}
            {box('f', t('жиры'))}
            {box('c', t('углев.'))}
          </div>
          <Button className="w-full" disabled={!valid || create.isPending} onClick={submit}>
            {t('Сохранить')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
