import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SLOTS, type Meal, type Slot } from '@fitbay/shared';
import { sum, ratio } from '@fitbay/calc';
import { Bar, Button, Card, Field, Ring, Seg, Sheet, Tile } from '../ui';
import { today, useDaySummary, useMealOps } from '../data/hooks';
import { useNav } from '../nav/store';
import { CheckinCard } from './Checkin';
import './screens.css';

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
    <div className="stack">
      <div className="daynav">
        <button type="button" className="iconbtn" aria-label={t('food.prevDay')} onClick={() => setDate(shift(date, -1))}>‹</button>
        <strong>{label}</strong>
        <button type="button" className="iconbtn" aria-label={t('food.nextDay')} disabled={isToday} onClick={() => setDate(shift(date, 1))}>›</button>
      </div>

      <Card>
        {target ? (
          <div className="today__summary">
            <Ring value={ratio(eaten.kcal, target.kcal)}>
              <span className="ring__big" data-testid="kcal-left">{Math.abs(left)}</span>
              <span className="muted small">{left >= 0 ? t('food.left') : t('food.over')}</span>
              <span className="muted small">
                {eaten.kcal} {t('food.of')} {target.kcal}
              </span>
            </Ring>
            <div className="today__bars">
              <Bar label={t('food.p')} eaten={eaten.p} goal={target.p} color="var(--teal)" unit={g} />
              <Bar label={t('food.f')} eaten={eaten.f} goal={target.f} color="var(--yellow)" unit={g} />
              <Bar label={t('food.c')} eaten={eaten.c} goal={target.c} color="var(--orange)" unit={g} />
            </div>
          </div>
        ) : (
          <p className="muted">{t('food.noTarget')}</p>
        )}
        <Button block onClick={() => setAdding(slotNow())}>
          + {t('today.addFood')}
        </Button>
      </Card>

      {SLOTS.map((slot) => {
        const list = meals.filter((m) => m.slot === slot);
        const s = sum(list);
        return (
          <Card key={slot}>
            <div className="slot__head">
              <h2 className="card__title" style={{ margin: 0 }}>{t(`food.slot_${slot}`)}</h2>
              <span className="muted small">{s.kcal ? `${s.kcal} ${t('food.kcalUnit')}` : ''}</span>
              <button type="button" className="chip" aria-label={`${t('food.add')}: ${t(`food.slot_${slot}`)}`} onClick={() => setAdding(slot)}>
                +
              </button>
            </div>
            {list.length === 0 ? (
              <p className="muted small" style={{ margin: '8px 0 0' }}>{t('food.empty')}</p>
            ) : (
              <ul className="meals">
                {list.map((m) => (
                  <li key={m.id} className="meal">
                    <div>
                      <div>{m.name}</div>
                      <div className="muted small">
                        {m.grams ? `${m.grams} ${g} · ` : ''}Б {m.p} · Ж {m.f} · У {m.c}
                      </div>
                    </div>
                    <span className="meal__kcal">{m.kcal}</span>
                    <button type="button" className="iconbtn" aria-label={`${t('food.delete')}: ${m.name}`} onClick={() => remove.mutate(m.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <CheckinCard date={date} />

      <div className="tiles">
        <Tile label={t('today.coach')} value="…" />
        <Tile label={t('today.nextWorkout')} value="…" onClick={() => setTab('workouts')} />
      </div>

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
    <Sheet open={slot !== null} title={t('food.addTitle')} onClose={onClose}>
      <div className="stack">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { value: 'manual', label: t('food.modeManual') },
            { value: 'photo', label: t('food.modePhoto') },
            { value: 'text', label: t('food.modeText') },
          ]}
        />
        {mode !== 'manual' ? (
          <p className="muted">{t('food.aiSoon')}</p>
        ) : (
          <>
            <div className="chips">
              {SLOTS.map((x) => (
                <button key={x} type="button" className="chip" aria-pressed={s === x} onClick={() => setS(x)}>
                  {t(`food.slot_${x}`)}
                </button>
              ))}
            </div>
            {field('name', t('food.name'), false)}
            <div className="grid2">
              {field('grams', t('food.grams'))}
              {field('kcal', t('food.kcal'))}
            </div>
            <div className="grid3">
              {field('p', `${t('food.p')}, ${t('food.g')}`)}
              {field('f', `${t('food.f')}, ${t('food.g')}`)}
              {field('c', `${t('food.c')}, ${t('food.g')}`)}
            </div>
            <Button block disabled={!valid || create.isPending} onClick={submit}>
              {t('food.save')}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
