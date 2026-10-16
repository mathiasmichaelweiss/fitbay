import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ciAvg,
  ciBad,
  CI_KEYS,
  clPatterns,
  clStats,
  GOALN,
  mealFlag,
  pkgUsage,
  pvf,
  type PatLevel,
} from '@fitbay/calc';
import { Tile, Tiles } from '@/components/ui/tile';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SingleToggle } from '@/components/ui/toggle-group';
import { askConfirm } from '@/components/ui/confirm';
import { api } from '@/data/api';
import { today } from '@/data/hooks';
import { useMyTrainer, useCabOps, useClients, useMySlots, useTrainerReqs, type Client } from '@/data/cabinet';
import { CI_F, CI_M } from '@/screens/Checkin';
import { CiGrid } from '@/screens/CiGrid';
import { NoteView } from '@/screens/train/WorkoutSheet';
import { UsageBar } from '@/screens/trainer/TrainerSheet';
import { cn } from '@/lib/utils';
import { useNav } from '@/nav/store';
import { CabHead } from './Head';
import { PlanSec, usePlanSum } from './PlanEd';
import { WorkoutsSection, WodSheet, type WodKey } from './Workouts';

const LV: Record<PatLevel, string> = { bad: 'var(--orange)', warn: 'var(--yellow)', good: '#7BC67B' };
const LVB: Record<PatLevel, string> = {
  bad: 'rgba(255,90,10,.16)',
  warn: 'rgba(242,183,5,.16)',
  good: 'rgba(123,198,123,.16)',
};
/** PATM прототипа: иконка и что предложить по каждому паттерну. */
const PATM: Record<string, [string, string]> = {
  'Белок под контролем': ['🥚', 'Похвалить и закрепить: белок в каждом приеме пищи уже стал привычкой.'],
  'Недобор белка': [
    '🥚',
    'Добавить по 25-30 г белка в завтрак и перекус: скир, творог, яйца, протеин. Проще, чем увеличивать ужин.',
  ],
  'Стабильно в калориях': ['🔥', 'Режим работает. Можно не трогать норму и смотреть на динамику веса.'],
  'Частый перебор калорий': [
    '🔥',
    'Найти 1-2 самых калорийных повторяющихся блюда и предложить замену, а не урезать все сразу.',
  ],
  'Скачет калорийность': ['🔥', 'Договориться о простом шаблоне дня: 3 приема пищи по похожей калорийности.'],
  'Срывы на выходных': [
    '📅',
    'Заранее планировать выходные: один свободный прием пищи вместо целого дня, белок с утра.',
  ],
  'Недоедание на выходных': ['📅', 'Напоминание о еде на выходных и 2-3 быстрых варианта без готовки.'],
  'Поздние приемы пищи': [
    '🌙',
    'Перенести часть калорий на день, сытный ужин до 20:00, на вечер белковый перекус вместо сладкого.',
  ],
  'Пропуск завтрака': [
    '☀️',
    'Не заставлять завтракать рано, но первый прием до 11:00 с 25+ г белка снимет вечерний голод.',
  ],
  'Много перекусов': ['🍪', 'Объединить перекусы в один полноценный прием пищи с белком и овощами.'],
  'Пропуски в дневнике': ['📖', 'Снизить порог: можно записывать голосом одной фразой за весь день.'],
  'Режим "густо-пусто"': ['〰️', 'Выровнять дни: меньше голодных дней, тогда исчезнут и дни с перебором.'],
  'Тренируется регулярно': ['🏋️', 'Можно добавлять нагрузку: прогрессия по весам или подходам.'],
  'Мало тренировок': ['🏋️', 'Уменьшить план до реального и закрепить 2 фиксированных дня в календаре.'],
  'Вес идет в нужную сторону': ['⚖️', 'Темп хороший, норму не менять.'],
  'Вес не по плану': [
    '⚖️',
    'Сначала проверить точность записей, потом корректировать норму на 150-200 ккал.',
  ],
};
const FLAG: Record<string, string> = { green: '#7BC67B', orange: 'var(--orange)', gray: '#666' };
const BA_ST: Record<string, string> = {
  draft: 'Черновик',
  pending: 'На проверке',
  verified: 'Проверено ✓',
  rejected: 'Нужны другие фото',
};

const useFmt = () => {
  const { i18n } = useTranslation();
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  return {
    lang: (i18n.language === 'de' ? 'de' : 'ru') as 'ru' | 'de',
    dl: (d: string) =>
      new Date(`${d}T12:00`).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' }),
    dt: (ts: number) =>
      new Date(ts).toLocaleString(L, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    tm: (ts: number) => new Date(ts).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' }),
  };
};

/** ciSpark прототипа: столбики среднего самочувствия за n дней. */
export function CiSpark({ list, n }: { list: { date: string }[]; n: number }) {
  const by = Object.fromEntries(list.map((x) => [x.date, x]));
  return (
    <span className="flex h-8 flex-none items-end gap-0.5">
      {Array.from({ length: n }, (_, i) => {
        const d = new Date(`${today()}T12:00`);
        d.setDate(d.getDate() - (n - 1 - i));
        const x = by[d.toISOString().slice(0, 10)];
        const a = x ? ciAvg(x as never) : 0;
        return (
          <i
            key={i}
            className="block w-[5px] rounded-[3px]"
            style={{
              height: a ? 6 + a * 5 : 3,
              background: a ? (a <= 2.5 ? '#e5484d' : a < 3.5 ? 'var(--yellow)' : '#7BC67B') : '#333',
            }}
          />
        );
      })}
    </span>
  );
}

/** renderCab прототипа: карточки клиентов (ср. 7 дней, белок, тренировки, флаг). */
export function ClientsList() {
  const { t } = useTranslation();
  const { data: clients = [] } = useClients();
  const { dt } = useFmt();
  const cl = useNav((s) => s.cl);
  const setCl = useNav((s) => s.open);
  const open = cl?.id ?? null;
  const setOpen = (id: string | null) => setCl({ cl: id ? { id } : null });
  return (
    <div data-testid="clients-list">
      <CabHead />
      {clients.length ? (
        clients.map((c) => {
          const s = clStats(c as never, today());
          return (
            <button
              key={c.id}
              type="button"
              data-testid="cl-row"
              onClick={() => setOpen(c.id)}
              className="mb-2.5 block w-full rounded-xl bg-card p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-[1.05rem]">
                  {c.name || t('Клиент')}
                  {c.ref && (
                    <span className="ml-1 rounded-full bg-brand-yellow px-[7px] py-0.5 align-[2px] text-[0.66rem] text-[#111]">
                      {t('по коду')}
                    </span>
                  )}
                </b>
                <span className="size-3 rounded-full" style={{ background: FLAG[s.flag] }} />
              </div>
              <div className="mt-0.5 text-[0.8rem] opacity-65">
                {t(GOALN[c.profile?.goal ?? ''] ?? '')} · {c.profile?.w ?? '?'} → {c.profile?.tw ?? '?'}{' '}
                {t('кг')}
              </div>
              <div className="mt-2.5 flex gap-4 text-[0.88rem]">
                <div>
                  <b>{s.k}</b>
                  <span className="opacity-60"> / {s.t.k || '?'}</span>
                  <div className="text-[0.72rem] opacity-55">{t('ккал, ср. 7 дн.')}</div>
                </div>
                <div>
                  <b>{s.p}</b>
                  <span className="opacity-60"> / {s.t.p || '?'}</span>
                  <div className="text-[0.72rem] opacity-55">{t('белок, ср.')}</div>
                </div>
                <div>
                  <b>{s.wk}</b>
                  <div className="text-[0.72rem] opacity-55">{t('трен. за 7 дн.')}</div>
                </div>
              </div>
              <div className="mt-2 text-[0.72rem] opacity-45">
                {t('Обновлено')}: {c.updatedAt ? dt(c.updatedAt) : '–'}
              </div>
            </button>
          );
        })
      ) : (
        <p className="opacity-60">{t('Пока ни один клиент не поделился данными.')}</p>
      )}
      {open && (
        <ClientSheet key={open} cid={open} sec0={cl?.sec as Sec | undefined} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

type Sec = 'food' | 'pat' | 'plan' | 'wo' | 'ci' | 'body' | 'act' | 'tips' | 'ba' | 'prof';

/** openClient прототипа: плитки клиента. */
function ClientSheet({ cid, sec0, onClose }: { cid: string; sec0?: Sec; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: clients = [] } = useClients();
  const { data: reqs = [] } = useTrainerReqs();
  const { data: slots = [] } = useMySlots();
  const { dl, dt, lang } = useFmt();
  const [sec, setSec] = useState<Sec | null>(sec0 ?? null);
  const planSum = usePlanSum(cid);
  const c = clients.find((x) => x.id === cid);
  if (!c) return null;
  const s = clStats(c as never, today());
  const tg = c.targets ?? { k: 0, p: 0, f: 0, c: 0 };
  const p = c.profile ?? {};
  const P = clPatterns(c as never, today(), lang, t);
  const bad = P.filter((x) => x.l !== 'good');
  const W = (m: { weight?: number }) => m.weight;
  const ms = c.measures.filter((m) => W(m) != null);
  const mL = ms.at(-1),
    m0 = ms[0];
  const lw = mL ? W(mL) : p.w;
  const dw = mL && m0 && ms.length > 1 ? Math.round(((W(mL) ?? 0) - (W(m0) ?? 0)) * 10) / 10 : null;
  const from7 = (() => {
    const d = new Date(`${today()}T12:00`);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const A = c.activities.filter((a) => a.date > from7);
  const st7 = A.length ? Math.round(A.reduce((a, x) => a + (x.steps || 0), 0) / 7) : 0;
  const tipsOpen = c.tips.filter((x) => !x.done).length;
  const tipSum = c.tips.length
    ? `${tipsOpen} ${t('открыто')} · ${c.tips.length - tipsOpen} ${t('выполнено')}`
    : t('Еще ничего не отправлено');
  const L = c.checkins;
  const l = L[L.length - 1];
  const R = reqs.filter((r) => r.uid === c.id && r.status === 'accepted' && r.sessions);
  return (
    <SheetPage open onOpenChange={(o) => !o && onClose()} title={c.name || t('Клиент')}>
      <Tiles data-testid="client-card">
        <Tile
          full
          color="orange"
          onClick={() => setSec('food')}
          label={t('ПИТАНИЕ · СР. 7 ДНЕЙ')}
          value={
            <span>
              {s.k}
              <span className="text-[.4em] opacity-60"> / {tg.k || '?'}</span>
            </span>
          }
          sub={`${t('Белок')} ${s.p} / ${tg.p} ${t('г')}`}
        />
        <Tile
          full
          color="teal"
          onClick={() => setSec('pat')}
          label={t('» АНАЛИЗ ПОВЕДЕНИЯ')}
          title={bad.length ? t(bad[0]?.h ?? '') : t('Слабых мест не видно')}
          sub={`${bad.length ? `${bad.length} ${t('зон роста')} · ` : ''}${P.filter((x) => x.l === 'good').length} ${t('сильных сторон')}`}
        >
          <span
            aria-hidden
            className="absolute right-4 top-4 size-3 rounded-full"
            style={{
              background: bad.some((x) => x.l === 'bad')
                ? 'var(--orange)'
                : bad.length
                  ? 'var(--yellow)'
                  : '#3a8a3a',
            }}
          />
        </Tile>
        <Tile
          full
          className="min-h-24 bg-[linear-gradient(135deg,#2a1a10,#161616)]"
          data-testid="cl-plan"
          onClick={() => setSec('plan')}
          label={<span className="text-brand-orange">{t('ПЛАН ЦЕЛЕЙ')}</span>}
          title={t('Фазы: сушка, набор, удержание')}
          sub={planSum}
        />
        {c.ba && (
          <Tile
            full
            className="min-h-[96px]"
            onClick={() => setSec('ba')}
            label={t('ДО И ПОСЛЕ')}
            title={t('Фото клиента')}
            sub={t(BA_ST[c.ba.status ?? 'draft'] ?? '')}
          />
        )}
        <Tile
          full
          color="yellow"
          className="min-h-[110px]"
          onClick={() => setSec('tips')}
          label={t('РЕКОМЕНДАЦИИ')}
          title={t('Написать клиенту')}
          sub={tipSum}
        />
        <button
          type="button"
          onClick={() => setSec('ci')}
          className={cn(
            'col-span-full block rounded-xl bg-card px-[18px] py-4 text-left',
            ciBad(L, today()) && 'shadow-[inset_0_0_0_1.5px_#e5484d]',
          )}
        >
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t('САМОЧУВСТВИЕ')}
          </span>
          {l ? (
            <div className="mt-2 flex items-center gap-2.5">
              <span className="text-[1.8rem]">{CI_F[Math.round(ciAvg(l)) - 1]}</span>
              <span className="min-w-0 flex-1">
                <b>{ciAvg(l).toFixed(1).replace('.', ',')} / 5</b>{' '}
                <span className="text-[0.8rem] text-muted-foreground">· {dl(l.date)}</span>
                {ciBad(L, today()) && (
                  <div className="text-[0.78rem] text-[#ff8a8d]">{t('Плохо несколько дней подряд')}</div>
                )}
              </span>
              <CiSpark list={L} n={14} />
            </div>
          ) : (
            <div className="mt-1.5 text-[0.85rem] text-muted-foreground">
              {t('Клиент ещё не отмечал самочувствие')}
            </div>
          )}
        </button>
        {R.slice(0, 2).map((r) => (
          <div key={r.id} className="col-span-full rounded-xl bg-card px-[18px] py-3.5">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t('ПАКЕТ')}
            </span>
            <b className="mt-1.5 block">{r.pkg?.name ?? ''}</b>
            <UsageBar big u={pkgUsage(r as never, slots as never, Date.now())} />
          </div>
        ))}
        <Tile
          color="cream"
          small
          onClick={() => setSec('wo')}
          label={t('ТРЕНИРОВКИ')}
          value={s.wk}
          sub={`${t('за 7 дней, план')} ${p.act ?? 3}`}
        />
        <Tile
          color="yellow"
          small
          onClick={() => setSec('body')}
          label={t('ВЕС')}
          value={lw ?? '?'}
          sub={`${dw != null ? `${dw > 0 ? '+' : ''}${dw} ${t('кг')} · ` : ''}${t('цель')} ${p.tw ?? '?'}`}
        />
        <Tile
          small
          onClick={() => setSec('act')}
          label={t('АКТИВНОСТЬ')}
          value={st7 ? `${(st7 / 1000).toFixed(1)}k` : A.length}
          sub={st7 ? t('шагов в день') : t('за 7 дней')}
        />
        <Tile
          color="peach"
          onClick={() => setSec('prof')}
          label={t('ПРОФИЛЬ')}
          title={t(GOALN[p.goal ?? ''] ?? '')}
          sub={`${p.sex === 'f' ? t('Ж') : t('М')}, ${p.age ?? '?'} · ${p.h ?? '?'} ${t('см')}`}
        />
      </Tiles>
      <p className="mt-3 text-[0.76rem] text-muted-foreground">
        {t('Согласие клиента')}: {c.consent?.at ? new Date(c.consent.at).toLocaleDateString() : '–'} ·{' '}
        {t('Обновлено')}: {c.updatedAt ? dt(c.updatedAt) : '–'}
      </p>
      {sec && <SectionSheet c={c} sec={sec} onClose={() => setSec(null)} />}
    </SheetPage>
  );
}

const TITLES: Record<Sec, string> = {
  food: 'Питание',
  pat: 'Анализ поведения',
  plan: 'План целей',
  wo: 'Тренировки',
  ci: 'Самочувствие',
  body: 'Вес и замеры',
  act: 'Активность',
  tips: 'Рекомендации',
  ba: 'До и после',
  prof: 'Профиль',
};

/** openClSec прототипа: разделы карточки клиента. */
function SectionSheet({ c, sec, onClose }: { c: Client; sec: Sec; onClose: () => void }) {
  const { t } = useTranslation();
  const [wod, setWod] = useState<WodKey | null>(null);
  return (
    <SheetPage open onOpenChange={(o) => !o && onClose()} title={t(TITLES[sec])}>
      {sec === 'food' && <FoodSec c={c} />}
      {sec === 'pat' && <PatSec c={c} />}
      {sec === 'plan' && <PlanSec c={c} />}
      {sec === 'wo' && <WorkoutsSection c={c} onOpen={setWod} />}
      {sec === 'ci' && <CiSec c={c} />}
      {sec === 'body' && <BodySec c={c} />}
      {sec === 'act' && <ActSec c={c} />}
      {sec === 'tips' && <TipsSec c={c} />}
      {sec === 'ba' && <BaSec c={c} />}
      {sec === 'prof' && <ProfSec c={c} />}
      {wod && <WodSheet c={c} k={wod} onClose={() => setWod(null)} />}
    </SheetPage>
  );
}

const Bar = ({ v, g, col }: { v: number; g: number; col: string }) => (
  <div className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-[#2a2a2a]">
    <div className="h-full" style={{ width: `${Math.min(100, g ? (v / g) * 100 : 0)}%`, background: col }} />
  </div>
);
const FlagIc = ({ l }: { l: 'bad' | 'warn' }) => (
  <span className="flex-none" style={{ color: l === 'bad' ? 'var(--orange)' : 'var(--yellow)' }}>
    {l === 'bad' ? '⊘' : '⚠'}
  </span>
);
const whyT = (why: string, t: (s: string) => string) => why.split(', ').map(t).join(', ');

function FoodSec({ c }: { c: Client }) {
  const { t } = useTranslation();
  const { dl, tm } = useFmt();
  const tg = c.targets ?? { k: 0, p: 0, f: 0, c: 0 };
  const D = c.days.slice(-14).reverse();
  const its = D.flatMap((d) => d.items ?? []);
  const hrs = Array(24).fill(0) as number[];
  for (const i of its)
    if (i.ts) {
      const hh = new Date(i.ts).getHours();
      hrs[hh] = (hrs[hh] ?? 0) + (i.kcal || 0);
    }
  const mx = Math.max(1, ...hrs);
  const avg = (f: 'k' | 'p' | 'f' | 'c') =>
    D.length ? Math.round(D.reduce((a, d) => a + (d[f] ?? 0), 0) / D.length) : 0;
  const top: Record<string, number> = {},
    topF: Record<string, ReturnType<typeof mealFlag>> = {};
  for (const i of its) {
    top[i.name] = (top[i.name] || 0) + 1;
    const f = mealFlag(i, tg);
    if (f && (!topF[i.name] || f.l === 'bad')) topF[i.name] = f;
  }
  const tp = Object.entries(top)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  return (
    <div className="grid gap-3">
      <Card className="gap-1">
        <span className="text-sm text-muted-foreground">{t('Среднее за 14 дней')}</span>
        <div className="flex justify-between text-[0.9rem]">
          <span>
            <b>{avg('k')}</b> / {tg.k} {t('ккал')}
          </span>
          <span>
            {t('Б')} <b>{avg('p')}</b> · {t('Ж')} <b>{avg('f')}</b> · {t('У')} <b>{avg('c')}</b>
          </span>
        </div>
      </Card>
      {its.some((i) => i.ts) && (
        <Card className="gap-1">
          <span className="text-sm text-muted-foreground">{t('Когда ест (ккал по часам)')}</span>
          <div className="flex h-[70px] items-end gap-0.5">
            {hrs.slice(6).map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px]"
                style={{
                  height: `${Math.max(2, (v / mx) * 100)}%`,
                  background: i + 6 >= 21 ? 'var(--orange)' : 'var(--teal)',
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.7rem] opacity-50">
            <span>6:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </Card>
      )}
      {tp.length > 0 && (
        <Card className="gap-0">
          <span className="mb-1 text-sm text-muted-foreground">{t('Частые продукты')}</span>
          {tp.map(([n, q]) => (
            <div key={n}>
              <div className="flex items-center justify-between py-[3px] text-[0.88rem]">
                <span className="flex items-center gap-1.5">
                  {topF[n] && <FlagIc l={topF[n].l} />}
                  {n}
                </span>
                <span className="opacity-60">×{q}</span>
              </div>
              {topF[n] && (
                <div className="-mt-0.5 mb-1 ml-5 text-[0.72rem] text-muted-foreground">
                  {whyT(topF[n].why, t)}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      <Card className="gap-0">
        <span className="text-sm text-muted-foreground">{t('По дням')}</span>
        {D.map((d) => {
          const fl = (d.items ?? []).map((i) => mealFlag(i, tg)).filter(Boolean);
          return (
            <details key={d.d} className="border-t border-[#2a2a2a] py-2 first-of-type:border-t-0">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex justify-between text-[0.88rem]">
                  <span className="flex items-center gap-1.5">
                    {dl(d.d)}
                    {fl.length > 0 && (
                      <>
                        <FlagIc l={fl.some((f) => f?.l === 'bad') ? 'bad' : 'warn'} />
                        <span className="text-[0.72rem] text-muted-foreground">{fl.length}</span>
                      </>
                    )}
                  </span>
                  <span>
                    <b style={{ color: d.k > tg.k * 1.1 ? 'var(--orange)' : '#fff' }}>{Math.round(d.k)}</b>{' '}
                    {t('ккал')} · {t('Б')}{' '}
                    <b style={{ color: d.p < tg.p * 0.8 ? 'var(--orange)' : '#7BC67B' }}>{Math.round(d.p)}</b>
                  </span>
                </div>
                <Bar v={d.k} g={tg.k} col="#FF5A0A" />
                <Bar v={d.p} g={tg.p} col="#F4EFE6" />
              </summary>
              <div className="mt-1.5 text-[0.82rem] opacity-80">
                {(d.items ?? []).length
                  ? (d.items ?? []).map((i, j) => {
                      const f = mealFlag(i, tg);
                      return (
                        <div key={j} className="flex items-start gap-1.5 py-0.5">
                          {f ? <FlagIc l={f.l} /> : <span className="w-3.5 flex-none" />}
                          <span>
                            {i.ts ? `${tm(i.ts)} · ` : ''}
                            {i.name} · {i.kcal} kcal
                            {f && (
                              <>
                                <br />
                                <span
                                  className="text-[0.74rem]"
                                  style={{ color: f.l === 'bad' ? 'var(--orange)' : 'var(--yellow)' }}
                                >
                                  {whyT(f.why, t)}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })
                  : t('Без деталей')}
              </div>
            </details>
          );
        })}
      </Card>
    </div>
  );
}

function PatSec({ c }: { c: Client }) {
  const { t, i18n } = useTranslation();
  const { lang } = useFmt();
  const ops = useCabOps();
  const { data: me } = useMyTrainer();
  const [open, setOpen] = useState<number | null>(null);
  const [sent, setSent] = useState<Record<number, string>>({});
  const [ai, setAi] = useState('');
  const [busy, setBusy] = useState(false);
  const P = clPatterns(c as never, today(), lang, t);
  const send = async (i: number, text: string) => {
    const items = [
      {
        id: `t${Date.now()}`,
        text,
        cat: 'food' as const,
        ts: Date.now(),
        from: me?.name || t('Тренер'),
        done: false,
        doneAt: null,
      },
      ...c.tips,
    ].slice(0, 50);
    try {
      await ops.tips.mutateAsync({ cid: c.id, items });
      setSent({ ...sent, [i]: t('Отправлено ✓') });
    } catch {
      setSent({ ...sent, [i]: t('Не удалось отправить.') });
    }
  };
  return (
    <>
      {P.length ? (
        <div className="mb-3 grid grid-cols-2 gap-2.5" data-testid="patterns">
          {P.map((x, i) => {
            const m = PATM[x.h] ?? ['•', ''];
            return (
              <div key={i} className="relative flex min-w-0 flex-col rounded-3xl bg-card p-3.5">
                <div
                  className="grid size-10 place-items-center rounded-[12px] text-[1.1rem]"
                  style={{ background: LVB[x.l], color: LV[x.l] }}
                >
                  {m[0]}
                </div>
                <b className="mt-3.5 text-[1.02rem] leading-tight">{t(x.h)}</b>
                <p className="mb-3 mt-2 flex-1 text-[0.78rem] leading-snug text-muted-foreground">{x.x}</p>
                {m[1] && (
                  <>
                    <button
                      type="button"
                      className="min-h-10 w-full rounded-full bg-[#262626] px-2 text-[0.8rem] font-medium"
                      onClick={() => setOpen(open === i ? null : i)}
                    >
                      {t('Что предложить')}
                    </button>
                    {open === i && (
                      <div className="mt-2.5 text-[0.8rem] leading-snug text-brand-cream">
                        {t(m[1])}
                        <button
                          type="button"
                          disabled={!!sent[i]}
                          onClick={() => send(i, t(m[1]))}
                          className="mt-2 min-h-10 w-full rounded-full bg-brand-cream px-2 text-[0.8rem] font-medium text-[#111]"
                        >
                          {sent[i] ?? t('Отправить клиенту')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="opacity-60">{t('Мало данных для анализа.')}</p>
      )}
      <Card className="gap-1">
        <span className="text-sm text-muted-foreground">» {t('AI-разбор для тренера')}</span>
        <div className="whitespace-pre-wrap text-[0.9rem] leading-normal" data-testid="cl-ai">
          {ai || <span className="opacity-60">{t('Причины паттернов и что предложить клиенту.')}</span>}
        </div>
        <Button
          variant="secondary"
          className="mt-2.5 h-12 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setAi(t('Анализирую...'));
            try {
              const r = await api.call<{ text: string }>('POST', '/ai/client_ai', {
                cid: c.id,
                lang: i18n.language,
                day: today(),
              });
              setAi(r.text);
            } catch {
              setAi(t('Не получилось, попробуй позже.'));
            }
            setBusy(false);
          }}
        >
          {ai && !busy ? t('Обновить разбор') : t('Сделать разбор')}
        </Button>
      </Card>
    </>
  );
}

function CiSec({ c }: { c: Client }) {
  const { t } = useTranslation();
  const L = [...c.checkins].reverse();
  if (!L.length) return <p className="opacity-60">{t('Клиент ещё не отмечал самочувствие')}</p>;
  const avg = (k: (typeof CI_KEYS)[number]) => {
    const v = L.slice(0, 7)
      .map((x) => +(x[k] ?? 0))
      .filter(Boolean);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  return (
    <div className="grid gap-3">
      {ciBad(c.checkins, today()) && (
        <Card className="bg-[rgba(229,72,77,.15)] text-[#ffb3b5]">
          ⚠️ {t('Плохое самочувствие несколько дней подряд. Стоит написать клиенту.')}
        </Card>
      )}
      <Card className="gap-0">
        <span className="text-sm text-muted-foreground">{t('Среднее за 7 отметок')}</span>
        <div className="mb-2 mt-1 flex justify-center">
          <CiSpark list={c.checkins} n={14} />
        </div>
        {CI_KEYS.map((k) => {
          const a = avg(k);
          return (
            <div key={k} className="flex items-center gap-2.5 py-[5px]">
              <span className="w-[120px] text-[0.86rem]">
                {CI_M[k][0]} {t(CI_M[k][1])}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded bg-[#262626]">
                <i
                  className="block h-full"
                  style={{
                    width: `${(a / 5) * 100}%`,
                    background: a <= 2.5 ? '#e5484d' : a < 3.5 ? 'var(--yellow)' : '#7BC67B',
                  }}
                />
              </span>
              <b className="w-[30px] text-right text-[0.85rem]">{a ? a.toFixed(1).replace('.', ',') : '–'}</b>
            </div>
          );
        })}
      </Card>
      <Card className="gap-1">
        <span className="text-sm text-muted-foreground">{t('По дням')}</span>
        <CiGrid list={c.checkins} />
      </Card>
    </div>
  );
}

function BodySec({ c }: { c: Client }) {
  const { t } = useTranslation();
  const ms = c.measures;
  if (!ms.length) return <p className="opacity-60">{t('Нет замеров.')}</p>;
  const f = ms[0],
    l = ms.at(-1);
  if (!f || !l) return null;
  const L = (
    [
      ['weight', 'Вес'],
      ['waist', 'Талия'],
      ['chest', 'Грудь'],
      ['hips', 'Бедра (ягодицы)'],
      ['biceps', 'Бицепс'],
    ] as const
  ).filter(([k]) => l[k] != null);
  return (
    <div className="grid gap-3">
      <Card className="gap-0">
        {L.map(([k, n]) => {
          const d = ms.length > 1 && f[k] != null ? Math.round(((l[k] ?? 0) - (f[k] ?? 0)) * 10) / 10 : null;
          return (
            <div key={k} className="flex justify-between py-1.5 text-[0.92rem]">
              <span>{t(n)}</span>
              <span>
                <b>{l[k]}</b>
                {d ? (
                  <span style={{ color: d < 0 ? '#7BC67B' : 'var(--orange)' }}>
                    {' '}
                    {`${d > 0 ? '+' : ''}${d}`}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
        <div className="text-[0.75rem] opacity-50">
          {t('Изменение с')} {f.date}
        </div>
      </Card>
      <Card className="gap-0">
        <span className="text-sm text-muted-foreground">{t('История')}</span>
        {[...ms].reverse().map((m) => (
          <div key={m.date} className="py-1 text-[0.86rem]">
            {m.date} ·{' '}
            {L.map(([k, n]) => (m[k] != null ? `${t(n)} ${m[k]}` : ''))
              .filter(Boolean)
              .join(' · ')}
          </div>
        ))}
      </Card>
    </div>
  );
}

function ActSec({ c }: { c: Client }) {
  const { t } = useTranslation();
  const { dl } = useFmt();
  const A = [...c.activities].reverse();
  return (
    <Card className="gap-0">
      {A.length ? (
        A.slice(0, 20).map((a, i) => (
          <div key={i} className="border-t border-[#2a2a2a] py-[5px] text-[0.86rem] first:border-t-0">
            {dl(a.date)} · {a.name} · {a.kcal} kcal{a.min ? ` · ${a.min} ${t('мин')}` : ''}
            {a.steps ? ` · ${a.steps} ${t('шагов')}` : ''}
          </div>
        ))
      ) : (
        <div className="opacity-60">{t('Нет данных.')}</div>
      )}
    </Card>
  );
}

/** tipsSecHtml прототипа: новая рекомендация по теме, отправленные со статусом. */
function TipsSec({ c }: { c: Client }) {
  const { t, i18n } = useTranslation();
  const ops = useCabOps();
  const { data: me } = useMyTrainer();
  const [cat, setCat] = useState<'food' | 'train'>('food');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const fd = (ts: number) =>
    new Date(ts).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' });
  const send = async () => {
    const x = text.trim();
    if (!x) return;
    try {
      await ops.tips.mutateAsync({
        cid: c.id,
        items: [
          {
            id: `t${Date.now()}`,
            text: x,
            cat,
            ts: Date.now(),
            from: me?.name || t('Тренер'),
            done: false,
            doneAt: null,
          },
          ...c.tips,
        ].slice(0, 50),
      });
      setText('');
      setErr('');
    } catch {
      setErr(t('Не удалось отправить.'));
    }
  };
  return (
    <div className="grid gap-3">
      <Card className="gap-2">
        <span className="text-sm text-muted-foreground">{t('Новая рекомендация')}</span>
        <div className="-mt-0.5 text-[0.82rem] leading-snug text-muted-foreground">
          {t(
            'Короткий ориентир для клиента. Он увидит его на главной в нужном разделе, получит уведомление в колокольчике и сможет отметить как выполненное. Ты увидишь, что выполнено.',
          )}
        </div>
        <span className="text-[0.8rem] text-muted-foreground">{t('Тема')}</span>
        <SingleToggle
          value={cat}
          onChange={setCat}
          options={[
            { value: 'food', label: t('🍽 Питание') },
            { value: 'train', label: t('🏋️ Тренировки') },
          ]}
        />
        <div className="text-[0.76rem] text-muted-foreground">
          {t(
            cat === 'food'
              ? 'Клиент увидит это в разделе «Питание».'
              : 'Клиент увидит это в разделе «Тренировки».',
          )}
        </div>
        <Textarea
          rows={3}
          value={text}
          aria-label={t('Новая рекомендация')}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(
            cat === 'food'
              ? 'Например: добавь 30 г белка к завтраку'
              : 'Например: в среду +2,5 кг в жиме, 3×8',
          )}
        />
        <Button className="w-full" onClick={send}>
          {t('Отправить клиенту')}
        </Button>
        {err && (
          <div role="alert" className="text-sm text-brand-orange">
            {err}
          </div>
        )}
      </Card>
      <Card className="gap-0" data-testid="sent-tips">
        <span className="text-sm text-muted-foreground">{t('Отправлено')}</span>
        {c.tips.length ? (
          c.tips.map((x) => (
            <div
              key={x.id}
              className="flex items-start gap-2.5 border-t border-[#2a2a2a] py-2.5 first-of-type:border-t-0"
            >
              <span
                className="grid size-[22px] flex-none place-items-center rounded-full text-[0.75rem] text-[#111]"
                style={{ background: x.done ? '#7BC67B' : '#333' }}
              >
                {x.done ? '✓' : ''}
              </span>
              <div className="flex-1 text-[0.9rem] leading-snug">
                {x.text}
                <div className="mt-[3px] text-[0.72rem] text-muted-foreground">
                  {x.cat === 'train' ? '🏋️' : '🍽'} {fd(x.ts)} ·{' '}
                  {x.done ? `${t('выполнено')}${x.doneAt ? ` ${fd(x.doneAt)}` : ''}` : t('ждет')}
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Удалить')}
                className="grid size-11 place-items-center opacity-50"
                onClick={async () => {
                  if (await askConfirm(t('Удалить рекомендацию?')))
                    await ops.tips
                      .mutateAsync({ cid: c.id, items: c.tips.filter((y) => y.id !== x.id) })
                      .catch(() => {});
                }}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="opacity-60">{t('Еще ничего не отправлено')}</div>
        )}
      </Card>
    </div>
  );
}

/** baSecHtml + bindBASec прототипа: проверка фото «до и после». */
function BaSec({ c }: { c: Client }) {
  const { t, i18n } = useTranslation();
  const ops = useCabOps();
  const { data: me } = useMyTrainer();
  const [note, setNote] = useState(c.ba?.note ?? '');
  const d = c.ba;
  if (!d) return <p className="opacity-60">{t('Клиент еще не загрузил фото.')}</p>;
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const one = (x: typeof d.before, l: string) => (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 text-[0.78rem] text-muted-foreground">{t(l)}</div>
      {x?.img && <img src={x.img} alt={t(l)} className="aspect-[3/4] w-full rounded-[14px] object-cover" />}
      <div className="mt-1.5 text-[0.8rem]">
        {x
          ? `${new Date(`${x.date}T12:00`).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' })}${x.w ? ` · ${x.w} ${t('кг')}` : ''}`
          : ''}
      </div>
    </div>
  );
  const dw = d.before?.w && d.after?.w ? Math.round((d.after.w - d.before.w) * 10) / 10 : null;
  const days =
    d.before && d.after ? Math.round((Date.parse(d.after.date) - Date.parse(d.before.date)) / 864e5) : null;
  const set = (status: string) =>
    ops.ba.mutate({
      cid: c.id,
      ba: { ...d, status, note: note.trim(), reviewedAt: Date.now(), reviewer: me?.name ?? '' },
    });
  return (
    <div className="grid gap-3">
      <Card className="gap-0">
        <div className="flex gap-2.5">
          {one(d.before, 'До')}
          {one(d.after, 'После')}
        </div>
        <div className="mt-3 text-[0.9rem] leading-relaxed">
          {dw != null && (
            <>
              {t('Вес')}:{' '}
              <b style={{ color: dw < 0 ? '#7BC67B' : 'var(--orange)' }}>
                {`${dw > 0 ? '+' : ''}${dw}`} {t('кг')}
              </b>
            </>
          )}
          {days != null ? ` ${t('за')} ${days} ${t('дн.')}` : ''}
          <br />
          {t('Публикация')}: <b>{d.consent?.publish ? t('разрешена') : t('не разрешена')}</b>
          {d.consent?.hideFace ? ` · ${t('скрыть лицо')}` : ''}
          <br />
          {t('Статус')}: <b>{t(BA_ST[d.status ?? 'draft'] ?? '')}</b>
        </div>
      </Card>
      <Card className="gap-2">
        <span className="text-sm text-muted-foreground">
          {t('Комментарий клиенту (если нужны другие фото)')}
        </span>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label={t('Комментарий клиенту (если нужны другие фото)')}
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-12 flex-1 text-brand-orange"
            onClick={() => set('rejected')}
          >
            {t('Нужны другие фото')}
          </Button>
          <Button className="h-12 flex-1" onClick={() => set('verified')}>
            {t('Проверено, настоящее')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ProfSec({ c }: { c: Client }) {
  const { t } = useTranslation();
  const p = c.profile ?? {};
  const tg = c.targets ?? { k: 0, p: 0, f: 0, c: 0 };
  return (
    <Card className="text-[0.92rem] leading-[1.8]">
      <div>
        {t('Цель')}: <b>{t(GOALN[p.goal ?? ''] ?? '')}</b>
        <br />
        {p.sex === 'f' ? t('Женщина') : t('Мужчина')}, {p.age ?? '?'} · {p.h ?? '?'} {t('см')}
        <br />
        {t('Вес')}: <b>{p.w ?? '?'}</b> → {p.tw ?? '?'} {t('кг')}
        <br />
        {t('тренировок в неделю')}: {p.act ?? '?'}
        <br />
        {t('Норма')}: {tg.k} {t('ккал')}, {t('Б')} {tg.p} · {t('Ж')} {tg.f} · {t('У')} {tg.c}
      </div>
    </Card>
  );
}

export { pvf, NoteView };
