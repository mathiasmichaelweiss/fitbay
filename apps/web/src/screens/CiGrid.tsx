import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { ciAvg, CI_KEYS } from '@fitbay/calc';
import type { Checkin } from '@fitbay/shared';
import { cn } from '@/lib/utils';
import { shiftDay, today } from '@/data/hooks';
import { CI_F, CI_M } from './Checkin';

const cc = (v?: number) => (v ? (v <= 2 ? '#e5484d' : v <= 3 ? '#F2B705' : '#7BC67B') : '#262626');

/**
 * ciGrid прототипа: тепловая карта самочувствия за n дней (строка на пункт, столбец на день, итог смайликом).
 * Лупа: при нажатии клетка увеличивается, палец можно вести по строке; отпускание выбирает день и показывает детали.
 */
export function CiGrid({ list, n = 14 }: { list: Checkin[]; n?: number }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? de : ru;
  const by = Object.fromEntries(list.map((x) => [x.date, x])) as Record<string, Checkin>;
  const days = Array.from({ length: n }, (_, i) => shiftDay(today(), i - n + 1));
  const [sel, setSel] = useState<string | null>(null);
  const [press, setPress] = useState<string | null>(null);
  const row = useRef<string | null>(null);
  const dl = (d: string) => format(parseISO(d), 'd MMM', { locale });
  const notes = [...days].reverse().map((d) => by[d]).filter((x): x is Checkin => !!x?.note);
  const x = sel ? by[sel] : undefined;

  const cellAt = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]');
    return el && el.dataset.row === row.current ? el.dataset.cell! : null;
  };

  return (
    <div data-testid="ci-grid" data-vaul-no-drag>
      <div
        className="grid w-full select-none items-center gap-[3px] text-[0.72rem] [-webkit-touch-callout:none]"
        style={{ gridTemplateColumns: `minmax(0,78px) repeat(${n},minmax(0,1fr))` }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerMove={(e) => {
          if (!press) return;
          const c = cellAt(e);
          if (c && c !== press) setPress(c);
        }}
        onPointerUp={() => {
          if (press) setSel(press.split('|')[1]!);
          setPress(null);
        }}
        onPointerCancel={() => setPress(null)}
      >
        <span />
        {days.map((d, i) => (
          <span key={d} className="text-center text-[0.62rem] text-muted-foreground">
            {i % 2 === (n - 1) % 2 ? +d.slice(8) : ''}
          </span>
        ))}
        {CI_KEYS.map((k) => (
          <Row key={k}>
            <span className="truncate text-[0.68rem] text-[#bbb]">{t(CI_M[k][1])}</span>
            {days.map((d) => {
              const id = `${k}|${d}`;
              const pr = press === id;
              return (
                <i
                  key={d}
                  data-cell={id}
                  data-row={k}
                  role="button"
                  aria-label={`${t(CI_M[k][1])} ${dl(d)}`}
                  onPointerDown={(e) => {
                    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                    row.current = k;
                    setPress(id);
                  }}
                  onClick={() => setSel(d)}
                  className={cn(
                    'relative block aspect-square cursor-pointer rounded-[4px] transition-transform duration-150 [touch-action:manipulation]',
                    pr && 'z-[5] -translate-x-[35%] -translate-y-[210%] scale-[5] rounded-[2.5px] shadow-[0_6px_16px_rgba(0,0,0,.7),0_0_0_1px_rgba(255,255,255,.5)]',
                    !pr && sel === d && 'z-[2] shadow-[0_0_0_2px_#fff]',
                  )}
                  style={{ background: cc(by[d]?.[k]) }}
                >
                  {pr && <span className="absolute left-[2px] top-[2px] text-[2.8px] font-extrabold not-italic leading-none text-[#111]">{`${+d.slice(8)}.${d.slice(5, 7)}`}</span>}
                </i>
              );
            })}
          </Row>
        ))}
        <span className="text-muted-foreground">{t('Итог')}</span>
        {days.map((d) => {
          const a = by[d] ? ciAvg(by[d]!) : 0;
          return (
            <button key={d} type="button" onClick={() => setSel(d)} className={cn('text-center text-[0.72rem] leading-[1.4]', sel === d && 'scale-125')}>
              {a ? CI_F[Math.round(a) - 1] : '·'}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
        <span>
          <i className="inline-block size-2 rounded-[2px] bg-[#7BC67B]" /> {t('хорошо')}
        </span>
        <span>
          <i className="inline-block size-2 rounded-[2px] bg-[#F2B705]" /> {t('средне')}
        </span>
        <span>
          <i className="inline-block size-2 rounded-[2px] bg-[#e5484d]" /> {t('плохо')}
        </span>
        <span>{t('нажми на день')}</span>
      </div>
      {sel && (
        <div className="mt-2 rounded-[14px] bg-[#222] px-3 py-2.5 text-[0.82rem]" data-testid="ci-day">
          <b>{dl(sel)}</b>
          {x ? (
            <>
              {' '}
              · {CI_F[Math.round(ciAvg(x)) - 1]} {ciAvg(x).toFixed(1).replace('.', ',')}
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                {CI_KEYS.map((k) => (
                  <span key={k}>
                    <span className="text-muted-foreground">{t(CI_M[k][1])}:</span> {x[k] ? t(CI_M[k][2][x[k]! - 1]!) : '–'}
                  </span>
                ))}
              </div>
              {x.note && <div className="mt-1.5">💬 {x.note}</div>}
            </>
          ) : (
            <>
              {' '}
              · <span className="text-muted-foreground">{t('нет отметки')}</span>
            </>
          )}
        </div>
      )}
      {notes.length > 0 && (
        <>
          <div className="mt-3 text-sm text-muted-foreground">💬 {t('Заметки')}</div>
          {notes.map((y) => (
            <div key={y.date} className="border-t border-[#2a2a2a] py-1.5 text-[0.84rem]">
              <span className="text-muted-foreground">{dl(y.date)}</span> · {y.note}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
const Row = ({ children }: { children: React.ReactNode }) => <>{children}</>;
