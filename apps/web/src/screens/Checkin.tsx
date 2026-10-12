import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Checkin } from '@fitbay/shared';
import { Button, Card, Field, Sheet } from '../ui';
import { useCheckin, useCheckinOps } from '../data/hooks';

type Key = 'sleep' | 'energy' | 'stress' | 'hunger' | 'pain' | 'adh';
const KEYS: Key[] = ['sleep', 'energy', 'stress', 'hunger', 'pain', 'adh'];
/** Для этих шкал 5 = сильнее (хуже), подписи и цвета перевёрнуты. */
const REVERSED = new Set<Key>(['stress', 'hunger', 'pain']);
const good = (k: Key, v: number) => (REVERSED.has(k) ? 6 - v : v);
const tone = (k: Key, v: number) => (good(k, v) >= 4 ? 'var(--teal)' : good(k, v) <= 2 ? 'var(--red)' : 'var(--yellow)');

export function CheckinCard({ date }: { date: string }) {
  const { t } = useTranslation();
  const { data } = useCheckin(date);
  const [open, setOpen] = useState(false);
  return (
    <Card title={t('ci.title')}>
      {data ? (
        <>
          <div className="ci__summary">
            {KEYS.map((k) => (
              <span key={k} className="ci__pill" style={{ borderColor: tone(k, data[k]), color: tone(k, data[k]) }}>
                {t(`ci.${k}`)} {data[k]}
              </span>
            ))}
          </div>
          <Button variant="ghost" block onClick={() => setOpen(true)}>
            {t('ci.edit')}
          </Button>
        </>
      ) : (
        <Button variant="ghost" block onClick={() => setOpen(true)}>
          {t('ci.mark')}
        </Button>
      )}
      <CheckinSheet open={open} date={date} initial={data} onClose={() => setOpen(false)} />
    </Card>
  );
}

function CheckinSheet({ open, date, initial, onClose }: { open: boolean; date: string; initial: Checkin | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { update } = useCheckinOps();
  const blank = { sleep: 0, energy: 0, stress: 0, hunger: 0, pain: 0, adh: 0, note: '' };
  const [v, setV] = useState(blank);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setV(initial ? { ...blank, ...initial, note: initial.note ?? '' } : blank);
  }
  const complete = KEYS.every((k) => v[k] > 0);

  return (
    <Sheet open={open} title={t('ci.title')} onClose={onClose}>
      <div className="stack">
        {KEYS.map((k) => (
          <div key={k} className="field">
            <span className="field__label">
              {t(`ci.${k}`)}
              <span className="ci__hint">
                1 = {t(REVERSED.has(k) ? 'ci.lowRev' : 'ci.low')}, 5 = {t(REVERSED.has(k) ? 'ci.highRev' : 'ci.high')}
              </span>
            </span>
            <div className="ci__scale" role="group" aria-label={t(`ci.${k}`)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className="seg__item" aria-pressed={v[k] === n} onClick={() => setV((x) => ({ ...x, [k]: n }))}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field label={t('ci.note')} value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} />
        <Button
          block
          disabled={!complete || update.isPending}
          onClick={() => {
            const { note, ...rest } = v;
            update.mutate({ id: date, date, ...rest, ...(note.trim() ? { note: note.trim() } : {}) }, { onSuccess: onClose });
          }}
        >
          {t('ci.save')}
        </Button>
      </div>
    </Sheet>
  );
}
