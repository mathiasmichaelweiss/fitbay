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
  const kg = t('кг');

  return (
    <div className="grid gap-4">
      <Tiles>
        <Tile color="teal" label={t('Сейчас')} small value={current !== undefined ? fmt(current) : '…'} sub={kg} data-testid="w-current" />
        <Tile color="yellow" label={t('Цель')} small value={profile?.tw ? fmt(profile.tw) : '…'} sub={kg} />
        <Tile color="dark" label={t('Старт')} small value={start !== undefined ? fmt(start) : '…'} sub={kg} />
        <Tile color={diff <= 0 ? 'cream' : 'orange'} label={t('Изменение')} small value={`${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(Math.abs(diff))}`} sub={kg} data-testid="w-change" />
      </Tiles>

      <Card>
        <CardTitle>{t('Записать вес')}</CardTitle>
        <Field label={t('Вес сегодня, кг')} inputMode="decimal" placeholder={todays ? fmt(todays.weight) : ''} value={input} onChange={(e) => setInput(e.target.value)} />
        <Button
          className="w-full"
          disabled={!valid || update.isPending}
          onClick={() => {
            // поле очищаем сразу: иначе ответ сервера сотрёт уже введённое следующее значение
            const typed = input;
            setInput('');
            update.mutate({ id: today(), date: today(), weight: Math.round(n * 10) / 10 }, { onError: () => setInput(typed) });
          }}
        >
          {t('Сохранить')}
        </Button>
      </Card>

      <Card className="gap-2">
        <CardTitle>{t('История веса')}</CardTitle>
        <Spark values={weights.map((w) => w.weight)} />
        {weights.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{t('Пока нет записей')}</p>
        ) : (
          <ul className="m-0 grid list-none p-0">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <li key={w.id} data-testid="row" className="flex items-center gap-2 border-t py-2">
                <div className="flex-1">{new Date(`${w.date}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <span className="font-semibold tabular-nums">
                  {fmt(w.weight)} {kg}
                </span>
                <Button variant="ghost" size="icon" aria-label={`${t('Удалить')}: ${w.date}`} onClick={() => remove.mutate(w.id)}>
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
