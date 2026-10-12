import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Checkin } from '@fitbay/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Field, FieldGroup } from '@/components/ui/field';
import { SingleToggle } from '@/components/ui/toggle-group';
import { useCheckin, useCheckinOps } from '@/data/hooks';

type Key = 'sleep' | 'energy' | 'stress' | 'hunger' | 'pain' | 'adh';
const KEYS: Key[] = ['sleep', 'energy', 'stress', 'hunger', 'pain', 'adh'];
/** Для этих шкал 5 = сильнее (хуже), подписи и цвета перевёрнуты. */
const REVERSED = new Set<Key>(['stress', 'hunger', 'pain']);
const good = (k: Key, v: number) => (REVERSED.has(k) ? 6 - v : v);
const variant = (k: Key, v: number) => (good(k, v) >= 4 ? 'good' : good(k, v) <= 2 ? 'bad' : 'warn');
const SCALE = ['1', '2', '3', '4', '5'] as const;

export function CheckinCard({ date }: { date: string }) {
  const { t } = useTranslation();
  const { data } = useCheckin(date);
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardTitle>{t('ci.title')}</CardTitle>
      {data && (
        <div className="flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <Badge key={k} variant={variant(k, data[k])}>
              {t(`ci.${k}`)} {data[k]}
            </Badge>
          ))}
        </div>
      )}
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        {data ? t('ci.edit') : t('ci.mark')}
      </Button>
      <CheckinDrawer open={open} date={date} initial={data} onClose={() => setOpen(false)} />
    </Card>
  );
}

function CheckinDrawer({ open, date, initial, onClose }: { open: boolean; date: string; initial: Checkin | null; onClose: () => void }) {
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
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('ci.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="grid gap-4">
          {KEYS.map((k) => (
            <FieldGroup
              key={k}
              label={t(`ci.${k}`)}
              hint={`1 = ${t(REVERSED.has(k) ? 'ci.lowRev' : 'ci.low')}, 5 = ${t(REVERSED.has(k) ? 'ci.highRev' : 'ci.high')}`}
            >
              <SingleToggle
                value={v[k] ? String(v[k]) : ''}
                onChange={(n) => setV((x) => ({ ...x, [k]: Number(n) }))}
                options={SCALE.map((n) => ({ value: n, label: n }))}
              />
            </FieldGroup>
          ))}
          <Field label={t('ci.note')} value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} />
          <Button
            className="w-full"
            disabled={!complete || update.isPending}
            onClick={() => {
              const { note, ...rest } = v;
              update.mutate({ id: date, date, ...rest, ...(note.trim() ? { note: note.trim() } : {}) }, { onSuccess: onClose });
            }}
          >
            {t('ci.save')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
