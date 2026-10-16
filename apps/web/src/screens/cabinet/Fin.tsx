import { useTranslation } from 'react-i18next';
import { finOverview, type PkgRequest } from '@fitbay/calc';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useClients, useMySlots, useMyTrainer, useTrainerReqs } from '@/data/cabinet';
import { UsageBar } from '@/screens/trainer/TrainerSheet';
import { fmtD } from '@/screens/trainer/format';

/** «Обзор» тренера (renderFin прототипа): выручка, клиенты, занятия, пакеты. Числа из calc finOverview. */
export function Fin() {
  const { t, i18n } = useTranslation();
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const { data: reqs = [] } = useTrainerReqs();
  const { data: slots = [] } = useMySlots();
  const { data: clients = [] } = useClients();
  const { data: me } = useMyTrainer();
  const f = finOverview(
    reqs as unknown as PkgRequest[],
    slots,
    clients.map((c) => ({ updatedAt: c.updatedAt ?? 0 })),
    !!me?.partner,
    Date.now(),
  );
  const eur = (n: number) => `${Math.round(n).toLocaleString(L)} €`;
  const mn = (m: number) =>
    new Date(Math.floor(m / 12), m % 12, 1).toLocaleDateString(L, { month: 'short' }).replace('.', '');
  const vals = f.months.map((x) => x.v),
    mx = Math.max(1, ...vals),
    any = vals.some(Boolean);
  const d = f.revenue - f.revenuePrev;
  const tile = (l: string, v: React.ReactNode, sub: string, orange?: boolean) => (
    <div
      className={cn('rounded-xl px-4 py-3.5', orange ? 'bg-brand-orange text-[#111]' : 'bg-card')}
      data-testid="fin-tile"
    >
      <span
        className={cn(
          'text-[0.68rem] font-semibold tracking-[0.06em]',
          orange ? 'opacity-75' : 'text-muted-foreground',
        )}
      >
        {t(l)}
      </span>
      <b className="mt-1.5 block text-[1.5rem]">{v}</b>
      {sub && <span className="text-[0.76rem] opacity-75">{sub}</span>}
    </div>
  );
  return (
    <div data-testid="fin" className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {tile(
          'ВЫРУЧКА ЗА МЕСЯЦ',
          eur(f.revenue),
          `${d >= 0 ? '+' : ''}${eur(d)} ${t('к прошлому')}${f.commission ? ` · ${t('чистыми')} ${eur(f.net)}` : ''}`,
          true,
        )}
        {tile('АКТИВНЫЕ КЛИЕНТЫ', f.activeClients, `${t('из')} ${f.clients}`)}
        {tile(
          'ЗАНЯТИЙ В МЕСЯЦЕ',
          f.done,
          f.burned ? `🔥 ${f.burned} ${t('сгорело')}` : `${t('прошлый')}: ${f.donePrev}`,
        )}
        {tile('ОПЛАЧЕНО ВПЕРЁД', f.prepaid, t('занятий ещё не проведено'))}
      </div>
      <Card className="gap-0">
        <span className="text-sm text-muted-foreground">{t('Выручка по месяцам')}</span>
        {!any && (
          <div className="mt-1.5 text-[0.8rem] text-muted-foreground">
            {t('Здесь появится выручка, когда ты примешь первые заявки на пакеты')}
          </div>
        )}
        <div className="mt-2.5 flex items-end gap-2" style={{ height: any ? 120 : 40 }}>
          {f.months.map((x, i) => (
            <div key={x.m} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-[3px] text-[0.66rem] text-muted-foreground">
                {x.v ? Math.round(x.v) : ''}
              </span>
              <i
                className="block w-full rounded-t-md rounded-b-[2px]"
                style={{
                  height: Math.max(3, (x.v / mx) * 90),
                  background: i === 5 ? 'var(--orange)' : '#3a3a3a',
                }}
              />
              <span className="mt-1 text-[0.7rem] text-muted-foreground">{mn(x.m)}</span>
            </div>
          ))}
        </div>
        {f.commission ? (
          <div className="mt-2.5 text-[0.74rem] text-muted-foreground">
            {t('Комиссия FitBay 12,5% уже учтена в «чистыми»')}
          </div>
        ) : (
          <div className="mt-2.5 text-[0.74rem] text-[#7BC67B]">✓ {t('Партнёр: без комиссии FitBay')}</div>
        )}
      </Card>
      <Card className="gap-0">
        <span className="text-sm text-muted-foreground">{t('Скоро закончатся пакеты')}</span>
        {f.ending.length ? (
          f.ending.map((x) => (
            <div key={`${x.r.uid}${x.r.at}`} className="border-t border-[#2a2a2a] py-2 first-of-type:mt-1">
              <div className="flex justify-between gap-2">
                <b>{x.r.name}</b>
                <span className="text-[0.8rem] text-muted-foreground">{x.r.pkg?.name}</span>
              </div>
              <UsageBar u={x.u} />
            </div>
          ))
        ) : (
          <p className="mt-1.5 mb-0 text-[0.86rem] text-muted-foreground">
            {t('Пока у всех хватает занятий')}
          </p>
        )}
      </Card>
      <Card className="gap-0">
        <span className="text-sm text-muted-foreground">{t('Все пакеты клиентов')}</span>
        {f.all.length ? (
          f.all.map((x) => (
            <div key={`${x.r.uid}${x.r.at}`} className="border-t border-[#2a2a2a] py-2 first-of-type:mt-1">
              <div className="flex justify-between gap-2">
                <b>{x.r.name}</b>
                <span className="text-[0.86rem]">{x.r.pkg?.price}</span>
              </div>
              <div className="text-[0.78rem] text-muted-foreground">
                {x.r.pkg?.name} · {fmtD(x.r.answeredAt || x.r.at || 0, i18n.language)}
              </div>
              <UsageBar u={x.u} />
            </div>
          ))
        ) : (
          <p className="mt-1.5 mb-0 text-[0.86rem] text-muted-foreground">{t('Принятых пакетов пока нет')}</p>
        )}
      </Card>
      {f.top.length > 0 && (
        <Card className="gap-0">
          <span className="text-sm text-muted-foreground">{t('Клиенты по выручке')}</span>
          {f.top.map(([n, v], i) => (
            <div key={n} className="flex items-center gap-2.5 py-1.5">
              <span className="w-[18px] text-muted-foreground">{i + 1}</span>
              <span className="flex-1">{n}</span>
              <b>{eur(v)}</b>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
