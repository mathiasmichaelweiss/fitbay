import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Tile } from '../ui';
import { today, useMeasureOps, useMeasures, useProfile } from '../data/hooks';

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

/** Линия веса. Простой SVG без библиотек; диапазоны и среднее появятся в A3.5. */
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
  const { t } = useTranslation();
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

  return (
    <div className="stack">
      <div className="tiles">
        <Tile label={t('weight.current')} value={current !== undefined ? `${fmt(current)} ${t('weight.kg')}` : '…'} tone="teal" />
        <Tile label={t('weight.target')} value={profile?.tw ? `${fmt(profile.tw)} ${t('weight.kg')}` : '…'} tone="yellow" />
        <Tile label={t('weight.start')} value={start !== undefined ? `${fmt(start)} ${t('weight.kg')}` : '…'} />
        <Tile label={t('weight.change')} value={`${diff > 0 ? '+' : ''}${fmt(diff)} ${t('weight.kg')}`} tone={diff <= 0 ? 'teal' : 'orange'} />
      </div>

      <Card title={t('weight.add')}>
        <div className="stack">
          <Field label={t('weight.today')} inputMode="decimal" placeholder={todays ? fmt(todays.weight) : ''} value={input} onChange={(e) => setInput(e.target.value)} />
          <Button
            block
            disabled={!valid || update.isPending}
            onClick={() => update.mutate({ id: today(), date: today(), weight: Math.round(n * 10) / 10 }, { onSuccess: () => setInput('') })}
          >
            {t('weight.save')}
          </Button>
        </div>
      </Card>

      <Card title={t('weight.history')}>
        <Spark values={weights.map((w) => w.weight)} />
        {weights.length === 0 ? (
          <p className="muted small">{t('weight.empty')}</p>
        ) : (
          <ul className="meals">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <li key={w.id} className="meal">
                <div>{new Date(`${w.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <span className="meal__kcal">
                  {fmt(w.weight)} {t('weight.kg')}
                </span>
                <button type="button" className="iconbtn" aria-label={`${t('weight.delete')}: ${w.date}`} onClick={() => remove.mutate(w.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
