import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Tile, Tiles } from '@/components/ui/tile';
import { today, useMeasureOps, useMeasures, useProfile } from '@/data/hooks';

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

/** Линия веса. Простой SVG; диапазоны и среднее появятся в A3.5. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 320, h = 90, pad = 6;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${pad + (i * (w - 2 * pad)) / (values.length - 1)},${h - pad - ((v - min) / span) * (h - 2 * pad)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="weight chart" preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Progress() {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const { data: all = [] } = useMeasures();
  const { update, remove } = useMeasureOps();
  const weights = all.filter((m) => typeof m.weight === 'number') as { id: string; date: string; weight: number }[];
  const todays = weights.find((m) => m.date === today());
  const [input, setInput] = useState('');
  const n = Number(input.replace(',', '.'));
  const valid = n >= 30 && n <= 300;

  const start = weights[0]?.weight ?? profile?.w;
  const current = weights.at(-1)?.weight ?? profile?.w;
  const diff = start !== undefined && current !== undefined ? current - start : 0;
  const kg = t('weight.kg');

  return (
    <div className="grid gap-4">
      <Tiles>
        <Tile label={t('weight.current')} value={current !== undefined ? `${fmt(current)} ${kg}` : '…'} tone="teal" />
        <Tile label={t('weight.target')} value={profile?.tw ? `${fmt(profile.tw)} ${kg}` : '…'} tone="yellow" />
        <Tile label={t('weight.start')} value={start !== undefined ? `${fmt(start)} ${kg}` : '…'} />
        <Tile label={t('weight.change')} value={`${diff > 0 ? '+' : ''}${fmt(diff)} ${kg}`} tone={diff <= 0 ? 'teal' : 'orange'} />
      </Tiles>

      <Card>
        <CardTitle>{t('weight.add')}</CardTitle>
        <Field label={t('weight.today')} inputMode="decimal" placeholder={todays ? fmt(todays.weight) : ''} value={input} onChange={(e) => setInput(e.target.value)} />
        <Button
          className="w-full"
          disabled={!valid || update.isPending}
          onClick={() => update.mutate({ id: today(), date: today(), weight: Math.round(n * 10) / 10 }, { onSuccess: () => setInput('') })}
        >
          {t('weight.save')}
        </Button>
      </Card>

      <Card className="gap-2">
        <CardTitle>{t('weight.history')}</CardTitle>
        <Spark values={weights.map((w) => w.weight)} />
        {weights.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{t('weight.empty')}</p>
        ) : (
          <ul className="m-0 grid list-none p-0">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <li key={w.id} data-testid="row" className="flex items-center gap-2 border-t py-2">
                <div className="flex-1">{new Date(`${w.date}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <span className="font-semibold tabular-nums">
                  {fmt(w.weight)} {kg}
                </span>
                <Button variant="ghost" size="icon" aria-label={`${t('weight.delete')}: ${w.date}`} onClick={() => remove.mutate(w.id)}>
                  <XIcon className="size-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
