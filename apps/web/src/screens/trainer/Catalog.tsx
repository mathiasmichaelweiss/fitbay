import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon } from 'lucide-react';
import { tPrice } from '@fitbay/calc';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMyLinks, useTrainers, type Trainer } from '@/data/trainers';
import { useNav } from '@/nav/store';

/** EDU прототипа */
export const EDU: Record<string, string> = { trainer: 'Сертифицированный тренер', nutri: 'Нутрициолог / диетолог', physio: 'Физиотерапевт', sport: 'Спортивное образование' };

/** avatar() прототипа: круг с первой буквой на цвете тренера. */
export function Avatar({ t, size }: { t: Pick<Trainer, 'name' | 'color'>; size: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-full font-bold text-[#111]" style={{ width: size, height: size, background: t.color || '#B2D8D8', fontSize: size * 0.4 }}>
      {(t.name || '?')[0]}
    </span>
  );
}

/** .chipF прототипа */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('min-h-9 flex-none whitespace-nowrap rounded-full bg-[#222] px-3 py-1.5 text-[0.85rem]', on && 'bg-brand-cream font-semibold text-[#111]')}>
      {children}
    </button>
  );
}

type CatS = { q: string; sex: string; exp: number; edu: string[]; fmt: string; sort: 'rec' | 'cheap' | 'exp'; open: boolean };

/** sh-trs прототипа: поиск, сортировка, фильтры (пол, стаж, образование, формат), список тренеров. */
export function Catalog() {
  const { t } = useTranslation();
  const { catalog, open } = useNav();
  const { data: all = [] } = useTrainers();
  const { data: links = [] } = useMyLinks();
  const [s, setS] = useState<CatS>({ q: '', sex: '', exp: 0, edu: [], fmt: '', sort: 'rec', open: false });
  const L = all;
  const cities = [...new Set(L.map((x) => x.city).filter((c): c is string => !!c && !/онлайн|online/i.test(c)))];
  const n = (s.sex ? 1 : 0) + (s.exp ? 1 : 0) + s.edu.length + (s.fmt ? 1 : 0);
  const q = s.q.trim().toLowerCase();
  const vis = L.filter(
    (x) =>
      (!q || [x.name, x.spec, x.bio, x.city, ...(x.tags ?? [])].join(' ').toLowerCase().includes(q)) &&
      (!s.sex || x.sex === s.sex) &&
      (!s.exp || (+(x.exp ?? 0) || 0) >= s.exp) &&
      s.edu.every((e) => (x.edu ?? []).includes(e)) &&
      (!s.fmt || (s.fmt === 'online' ? x.online !== false : x.city === s.fmt.slice(2))),
  );
  if (s.sort === 'cheap') vis.sort((a, b) => (tPrice(a) ?? 1e9) - (tPrice(b) ?? 1e9));
  else if (s.sort === 'exp') vis.sort((a, b) => (+(b.exp ?? 0) || 0) - (+(a.exp ?? 0) || 0));
  const grp = (lab: string, opts: [string, string][], on: (v: string) => boolean, set: (v: string) => void) => (
    <div className="mt-2.5">
      <div className="text-[0.8rem] text-muted-foreground">{t(lab)}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {opts.map(([v, nm]) => (
          <Chip key={v} on={on(v)} onClick={() => set(v)}>
            {t(nm)}
          </Chip>
        ))}
      </div>
    </div>
  );
  const yrs = (e: number) => t(e >= 5 ? 'лет' : e > 1 ? 'года' : 'год');
  return (
    <SheetPage open={catalog} onOpenChange={(o) => !o && open({ catalog: false })} title={t('Тренеры')}>
      <label className="flex h-[46px] items-center gap-2 rounded-md border bg-secondary px-3">
        <SearchIcon className="size-[18px] opacity-60" />
        <input
          type="search"
          value={s.q}
          onChange={(e) => setS({ ...s, q: e.target.value })}
          placeholder={t('Поиск по имени или специализации')}
          aria-label={t('Поиск по имени или специализации')}
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </label>
      <div className="mb-1.5 mt-2.5 flex gap-2 overflow-x-auto">
        <Chip on={s.open || n > 0} onClick={() => setS({ ...s, open: !s.open })}>
          ⚙︎ {t('Фильтры')}
          {n ? ` · ${n}` : ''}
        </Chip>
        {(
          [
            ['rec', 'Рекомендуем'],
            ['cheap', 'Дешевле'],
            ['exp', 'Опытнее'],
          ] as const
        ).map(([k, nm]) => (
          <Chip key={k} on={s.sort === k} onClick={() => setS({ ...s, sort: k })}>
            {t(nm)}
          </Chip>
        ))}
      </div>
      {s.open && (
        <Card className="gap-0 px-4 py-3.5" data-testid="cat-filters">
          {grp('Пол тренера', [['', 'Любой'], ['m', 'Мужчина'], ['f', 'Женщина']], (v) => s.sex === v, (v) => setS({ ...s, sex: v }))}
          {grp('Стаж', [['0', 'Любой'], ['1', 'от 1 года'], ['3', 'от 3 лет'], ['5', 'от 5 лет']], (v) => String(s.exp) === v, (v) => setS({ ...s, exp: +v }))}
          {grp('Образование', Object.entries(EDU), (v) => s.edu.includes(v), (v) => setS({ ...s, edu: s.edu.includes(v) ? s.edu.filter((x) => x !== v) : [...s.edu, v] }))}
          {grp('Формат', [['', 'Любой'], ['online', 'Онлайн'], ...cities.map((c): [string, string] => [`c:${c}`, c])], (v) => s.fmt === v, (v) => setS({ ...s, fmt: v }))}
          {n > 0 && (
            <Button variant="secondary" className="mt-3 h-11 w-full" onClick={() => setS({ ...s, sex: '', exp: 0, edu: [], fmt: '' })}>
              {t('Сбросить фильтры')}
            </Button>
          )}
        </Card>
      )}
      <div className="mx-0.5 mb-2.5 mt-1.5 text-[0.8rem] text-muted-foreground" data-testid="cat-count">
        {t('Найдено')}: {vis.length}
      </div>
      {vis.length ? (
        vis.map((x) => {
          const p = tPrice(x);
          const mine = links.some((l) => l.trainer === x.id && l.consent);
          return (
            <button key={x.id} type="button" data-testid="tr-row" onClick={() => open({ trainer: x.id })} className="mb-2.5 flex w-full items-center gap-3.5 rounded-xl bg-card p-3.5 text-left">
              <Avatar t={x} size={58} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[1.05rem]">
                  {x.name}
                  {mine && <span className="ml-1 rounded-full bg-brand-teal px-[7px] py-0.5 align-[2px] text-[0.66rem] text-[#111]">{t('твой тренер')}</span>}
                </b>
                <span className="mt-0.5 block text-[0.84rem] leading-tight text-[#ccc]">{x.spec || x.bio || t(x.level || '')}</span>
                <span className="mt-1.5 flex flex-wrap gap-1 text-[0.7rem] text-muted-foreground">
                  {x.exp ? (
                    <span className="rounded-full bg-[#222] px-2 py-0.5">
                      {t('стаж')} {x.exp} {yrs(x.exp)}
                    </span>
                  ) : null}
                  {(x.edu ?? []).map((e) => (
                    <span key={e} className="rounded-full bg-[#222] px-2 py-0.5">
                      {t(EDU[e] ?? e)}
                    </span>
                  ))}
                  <span className="rounded-full bg-[#222] px-2 py-0.5">
                    {x.online !== false ? t('Онлайн') : ''}
                    {x.online !== false && x.city ? ' · ' : ''}
                    {x.city && !/онлайн/i.test(x.city) ? x.city : ''}
                  </span>
                </span>
              </span>
              {p != null && (
                <span className="flex-none text-right">
                  <b className="block">
                    {t('от')} {p} €
                  </b>
                  <span className="text-[0.7rem] text-muted-foreground">{t('за тренировку')}</span>
                </span>
              )}
            </button>
          );
        })
      ) : (
        <p className="opacity-60">{t('Никого не нашли. Попробуй убрать фильтры.')}</p>
      )}
    </SheetPage>
  );
}
