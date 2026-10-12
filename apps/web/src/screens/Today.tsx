import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { SLOTS, type Meal, type Slot } from '@fitbay/shared';
import { sum, ratio } from '@fitbay/calc';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { MacroBar, Ring } from '@/components/ui/ring';
import { Tile, Tiles } from '@/components/ui/tile';
import { SingleToggle } from '@/components/ui/toggle-group';
import { today, useDaySummary, useMealOps } from '@/data/hooks';
import { useNav } from '@/nav/store';
import { CheckinCard } from './Checkin';

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Слот по умолчанию по времени суток. */
const slotNow = (): Slot => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
};

export function Today() {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<Slot | null>(null);
  const { target, eaten, meals } = useDaySummary(date);
  const { remove } = useMealOps();
  const setTab = useNav((s) => s.setTab);

  const isToday = date === today();
  const label = isToday
    ? t('food.todayLabel')
    : date === shift(today(), -1)
      ? t('food.yesterday')
      : new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
  const left = target ? target.kcal - eaten.kcal : 0;
  const g = t('food.g');

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label={t('food.prevDay')} onClick={() => setDate(shift(date, -1))}>
          <ChevronLeftIcon className="size-5" />
        </Button>
        <strong>{label}</strong>
        <Button variant="ghost" size="icon" aria-label={t('food.nextDay')} disabled={isToday} onClick={() => setDate(shift(date, 1))}>
          <ChevronRightIcon className="size-5" />
        </Button>
      </div>

      <Card>
        {target ? (
          <div className="flex items-center gap-4 max-[360px]:flex-col">
            <Ring value={ratio(eaten.kcal, target.kcal)}>
              <span className="text-[28px] font-bold tabular-nums" data-testid="kcal-left">
                {Math.abs(left)}
              </span>
              <span className="text-sm text-muted-foreground">{left >= 0 ? t('food.left') : t('food.over')}</span>
              <span className="text-sm text-muted-foreground">
                {eaten.kcal} {t('food.of')} {target.kcal}
              </span>
            </Ring>
            <div className="grid min-w-0 flex-1 gap-3 max-[360px]:w-full">
              <MacroBar label={t('food.p')} eaten={eaten.p} goal={target.p} color="teal" unit={g} />
              <MacroBar label={t('food.f')} eaten={eaten.f} goal={target.f} color="yellow" unit={g} />
              <MacroBar label={t('food.c')} eaten={eaten.c} goal={target.c} color="orange" unit={g} />
            </div>
          </div>
        ) : (
          <p className="m-0 text-muted-foreground">{t('food.noTarget')}</p>
        )}
        <Button className="w-full" onClick={() => setAdding(slotNow())}>
          <PlusIcon /> {t('today.addFood')}
        </Button>
      </Card>

      {SLOTS.map((slot) => {
        const list = meals.filter((m) => m.slot === slot);
        const s = sum(list);
        return (
          <Card key={slot} className="gap-2">
            <CardHeader>
              <CardTitle>{t(`food.slot_${slot}`)}</CardTitle>
              {s.kcal > 0 && (
                <span className="text-sm text-muted-foreground">
                  {s.kcal} {t('food.kcalUnit')}
                </span>
              )}
              <Button variant="outline" size="icon" className="size-9" aria-label={`${t('food.add')}: ${t(`food.slot_${slot}`)}`} onClick={() => setAdding(slot)}>
                <PlusIcon />
              </Button>
            </CardHeader>
            {list.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">{t('food.empty')}</p>
            ) : (
              <ul className="m-0 grid list-none p-0">
                {list.map((m) => (
                  <li key={m.id} data-testid="row" className="flex items-center gap-2 border-t py-2">
                    <div className="min-w-0 flex-1 break-words">
                      <div>{m.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {m.grams ? `${m.grams} ${g} · ` : ''}Б {m.p} · Ж {m.f} · У {m.c}
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums">{m.kcal}</span>
                    <Button variant="ghost" size="icon" aria-label={`${t('food.delete')}: ${m.name}`} onClick={() => remove.mutate(m.id)}>
                      <XIcon className="size-5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <CheckinCard date={date} />

      <Tiles>
        <Tile label={t('today.coach')} value="…" />
        <Tile label={t('today.nextWorkout')} value="…" onClick={() => setTab('workouts')} />
      </Tiles>

      <AddFood date={date} slot={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

function AddFood({ date, slot, onClose }: { date: string; slot: Slot | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { create } = useMealOps();
  const [mode, setMode] = useState<'manual' | 'photo' | 'text'>('manual');
  const [s, setS] = useState<Slot>('breakfast');
  const [f, setF] = useState({ name: '', grams: '', kcal: '', p: '', f: '', c: '' });
  const [lastSlot, setLastSlot] = useState<Slot | null>(null);
  if (slot !== lastSlot) {
    setLastSlot(slot);
    if (slot) setS(slot);
  }
  const n = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
  const valid = f.name.trim() !== '' && n(f.kcal) > 0;

  const submit = () => {
    const meal: Partial<Meal> & { date: string } = {
      date, slot: s, name: f.name.trim(), kcal: n(f.kcal), p: n(f.p), f: n(f.f), c: n(f.c),
      ...(f.grams ? { grams: n(f.grams) } : {}),
    };
    create.mutate(meal, {
      onSuccess: () => {
        setF({ name: '', grams: '', kcal: '', p: '', f: '', c: '' });
        onClose();
      },
    });
  };
  const field = (k: keyof typeof f, label: string, numeric = true) => (
    <Field label={label} value={f[k]} inputMode={numeric ? 'decimal' : 'text'} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
  );

  return (
    <Drawer open={slot !== null} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('food.addTitle')}</DrawerTitle>
        </DrawerHeader>
        <div className="grid gap-4">
          <SingleToggle
            value={mode}
            onChange={setMode}
            options={[
              { value: 'manual', label: t('food.modeManual') },
              { value: 'photo', label: t('food.modePhoto') },
              { value: 'text', label: t('food.modeText') },
            ]}
          />
          {mode !== 'manual' ? (
            <p className="m-0 text-muted-foreground">{t('food.aiSoon')}</p>
          ) : (
            <>
              <SingleToggle variant="chip" value={s} onChange={setS} options={SLOTS.map((x) => ({ value: x, label: t(`food.slot_${x}`) }))} />
              {field('name', t('food.name'), false)}
              <div className="grid grid-cols-2 gap-3">
                {field('grams', t('food.grams'))}
                {field('kcal', t('food.kcal'))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {field('p', `${t('food.p')}, ${t('food.g')}`)}
                {field('f', `${t('food.f')}, ${t('food.g')}`)}
                {field('c', `${t('food.c')}, ${t('food.g')}`)}
              </div>
              <Button className="w-full" disabled={!valid || create.isPending} onClick={submit}>
                {t('food.save')}
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
