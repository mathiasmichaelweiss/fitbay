import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ciAvg, CI_KEYS, type CiKey } from '@fitbay/calc';
import type { Checkin } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { today, useCheckinOps, useCheckins } from '@/data/hooks';
import { CiGrid } from './CiGrid';

/** Порт CI_F, CI_M прототипа. */
export const CI_F = ['😫', '😕', '😐', '🙂', '😄'];
export const CI_M: Record<CiKey, [string, string, string[]]> = {
  sleep: ['😴', 'Сон', ['Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично']],
  energy: ['⚡', 'Энергия', ['Нет сил', 'Мало', 'Средне', 'Хорошо', 'Много']],
  stress: ['🧠', 'Стресс', ['Очень высокий', 'Высокий', 'Средний', 'Низкий', 'Нет']],
  hunger: ['🍽', 'Голод', ['Очень сильный', 'Сильный', 'Терпимо', 'Слабый', 'Нет']],
  pain: ['🤕', 'Боль, мышцы', ['Сильная боль', 'Болит', 'Немного', 'Чуть-чуть', 'Нет']],
  adh: ['🎯', 'Держусь плана', ['Совсем нет', 'Плохо', 'Наполовину', 'В основном', 'Полностью']],
};
const DAY_WORD = ['Тяжёлый день', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
const cc = (v: number) => (v <= 2 ? 'var(--red)' : v <= 3 ? 'var(--yellow)' : 'var(--ok)');

/** Плитка «Самочувствие» (renderCiTile прототипа). Чек-ин всегда за сегодня. */
export function CheckinTile() {
  const { t } = useTranslation();
  const { data: list = [] } = useCheckins();
  const x = list.find((c) => c.date === today());
  const [open, setOpen] = useState<null | { quick?: number }>(null);
  const av = x ? ciAvg(x) : 0;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        data-testid="ci-tile"
        onClick={() => setOpen({})}
        onKeyDown={(e) => e.key === 'Enter' && setOpen({})}
        className="col-span-full cursor-pointer rounded-xl bg-card px-[18px] py-4 text-left"
      >
        {x ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] font-semibold tracking-[0.06em] text-muted-foreground">{t('САМОЧУВСТВИЕ СЕГОДНЯ')}</span>
              <span className="text-[0.76rem] text-muted-foreground">{t('изменить')} ›</span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="text-[2.2rem] leading-none">{CI_F[Math.round(av) - 1]}</span>
              <span className="min-w-0 flex-1">
                <b className="block text-[1.15rem]">{t(DAY_WORD[Math.round(av) - 1]!)}</b>
                <span className="text-[0.8rem] text-muted-foreground">
                  {av.toFixed(1).replace('.', ',')} {t('из')} 5
                </span>
              </span>
              {list.length > 1 && <Spark list={list} n={7} />}
            </div>
            <div className="mt-3.5 grid grid-cols-3 gap-x-3 gap-y-2.5">
              {CI_KEYS.map((k) => {
                const v = x[k];
                return (
                  <div key={k}>
                    <div className="truncate text-[0.72rem] text-muted-foreground">{t(CI_M[k][1])}</div>
                    <div className="mt-[5px] h-[5px] overflow-hidden rounded-[3px] bg-[#2a2a2a]">
                      <i className="block h-full" style={{ width: `${v ? (v / 5) * 100 : 0}%`, background: v ? cc(v) : 'transparent' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <span className="text-[0.68rem] font-semibold tracking-[0.06em] text-muted-foreground">{t('САМОЧУВСТВИЕ')}</span>
            <b className="mt-1.5 block text-[1.1rem]">{t('Как ты сегодня?')}</b>
            <div className="mt-2.5 flex justify-between">
              {CI_F.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  aria-label={`${i + 1} / 5`}
                  className="rounded-[14px] bg-surface-3 px-2 py-1 text-[1.9rem]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen({ quick: i + 1 });
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[0.76rem] text-muted-foreground">{t('30 секунд: сон, энергия, стресс, голод. Видно тебе и тренеру')}</div>
          </>
        )}
      </div>
      <CheckinDrawer open={open} initial={x ?? null} onClose={() => setOpen(null)} />
    </>
  );
}

function Spark({ list, n }: { list: Checkin[]; n: number }) {
  const by = Object.fromEntries(list.map((c) => [c.date, c]));
  const bars = Array.from({ length: n }, (_, i) => {
    const d = new Date(`${today()}T12:00:00`);
    d.setDate(d.getDate() - (n - 1 - i));
    const x = by[d.toISOString().slice(0, 10)];
    const a = x ? ciAvg(x) : 0;
    return { a, key: i };
  });
  return (
    <span className="flex h-8 flex-none items-end gap-0.5" aria-hidden>
      {bars.map(({ a, key }) => (
        <i key={key} className="block w-[5px] rounded-[3px]" style={{ height: a ? 6 + a * 5 : 3, background: a ? (a <= 2.5 ? 'var(--red)' : a < 3.5 ? 'var(--yellow)' : 'var(--ok)') : '#333' }} />
      ))}
    </span>
  );
}

function CheckinDrawer({ open, initial, onClose }: { open: null | { quick?: number }; initial: Checkin | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { update } = useCheckinOps();
  const { data: list = [] } = useCheckins();
  const [d, setD] = useState<Partial<Record<CiKey, number>> & { note?: string }>({});
  const [err, setErr] = useState('');
  const [was, setWas] = useState<typeof open>(null);
  if (open !== was) {
    setWas(open);
    if (open) {
      setErr('');
      // openCi(q): быстрый выбор смайлика заполняет все пункты этим значением
      setD(initial ? { ...initial } : open.quick ? Object.fromEntries(CI_KEYS.map((k) => [k, open.quick])) : {});
    }
  }
  const save = () => {
    if (!CI_KEYS.some((k) => d[k])) return setErr(t('Отметь хотя бы один пункт.'));
    const note = (d.note ?? '').trim();
    update.mutate(
      { id: today(), date: today(), ...d, note: note || undefined },
      { onSuccess: onClose, onError: () => setErr(t('Не удалось сохранить.')) },
    );
  };

  return (
    <Drawer open={!!open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('Самочувствие')}</DrawerTitle>
        </DrawerHeader>
        <div className="rounded-xl bg-background/40">
          {CI_KEYS.map((k) => {
            const [ic, name, labels] = CI_M[k];
            const v = d[k];
            return (
              <div key={k} className="border-t border-[#2a2a2a] py-2.5 first:border-t-0" role="radiogroup" aria-label={t(name)}>
                <div className="flex justify-between text-[0.9rem]">
                  <span>
                    {ic} {t(name)}
                  </span>
                  <span className="text-[0.8rem] text-muted-foreground">{v ? t(labels[v - 1]!) : ''}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  {CI_F.map((f, i) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={v === i + 1}
                      aria-label={t(labels[i]!)}
                      onClick={() => setD((x) => ({ ...x, [k]: i + 1 }))}
                      className={cn('rounded-[14px] bg-secondary px-2 py-1.5 text-[1.6rem] opacity-70 grayscale-[.6] transition', v === i + 1 && 'bg-primary opacity-100 grayscale-0')}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <label htmlFor="ci-note" className="mb-1.5 mt-3 block text-[0.8rem] text-muted-foreground">
          {t('Заметка (необязательно)')}
        </label>
        <textarea
          id="ci-note"
          rows={2}
          value={d.note ?? ''}
          onChange={(e) => setD((x) => ({ ...x, note: e.target.value }))}
          placeholder={t('Например: мало спал из-за ребёнка, тянет поясницу')}
          className="w-full rounded-md border bg-secondary px-[13px] py-[11px] text-base outline-none focus-visible:border-ring"
        />
        {err && <p className="mt-2 text-[0.88rem] text-brand-orange">{err}</p>}
        <Button className="mt-2.5 w-full" onClick={save} disabled={update.isPending}>
          {t('Сохранить')}
        </Button>
        {list.length > 0 && (
          <div className="mt-4 rounded-xl bg-card p-4">
            <div className="mb-2 text-sm text-muted-foreground">{t('Последние дни')}</div>
            <CiGrid list={list} />
          </div>
        )}
        <p className="mt-3 text-[0.78rem] leading-[1.45] text-muted-foreground">
          {t('Если у тебя есть тренер и ты открыл ему данные, он видит отметки и получает сигнал, если несколько дней подряд тебе плохо.')}
        </p>
      </DrawerContent>
    </Drawer>
  );
}
