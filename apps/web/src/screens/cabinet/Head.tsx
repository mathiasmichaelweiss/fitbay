import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, TrashIcon } from 'lucide-react';
import { pkgSessDefault, pkgUsage, type PkgRequest } from '@fitbay/calc';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SingleToggle } from '@/components/ui/toggle-group';
import { askConfirm } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';
import { useCabOps, useClients, useMySlots, useMyTrainer, useTrainerReqs } from '@/data/cabinet';
import type { PkgReq, Trainer } from '@/data/trainers';
import { Avatar, EDU } from '@/screens/trainer/Catalog';
import { UsageBar } from '@/screens/trainer/TrainerSheet';
import { fmtD } from '@/screens/trainer/format';

/** Верх вкладки «Клиенты» у тренера (renderCab прототипа): профиль в каталоге, код, заявки, пакеты и ставки. */
export function CabHead() {
  return (
    <>
      <MyProfCard />
      <RefCard />
      <ReqCard />
      <MyPkgCard />
    </>
  );
}

const Lbl = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mt-3 mb-1.5 block text-[0.8rem] text-muted-foreground">
    {children}
  </label>
);
/** сервер перезаписывает профиль целиком, поэтому отправляем всё */
const full = (t: Trainer & { code?: string }, up: Partial<Trainer & { code?: string }>) => ({ ...t, ...up });

/** myProfCardHtml + tpClick прототипа. */
function MyProfCard() {
  const { t } = useTranslation();
  const { data: me } = useMyTrainer();
  const ops = useCabOps();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<(Trainer & { partner?: boolean }) | null>(null);
  const [err, setErr] = useState('');
  if (!me) return null;
  const v = d ?? me;
  const miss =
    ['spec', 'sex', 'exp'].filter((k) => !me[k as keyof Trainer]).length + ((me.edu ?? []).length ? 0 : 1);
  const set = (p: Partial<Trainer>) => setD({ ...v, ...p });
  const save = async () => {
    setErr('');
    try {
      await ops.profile.mutateAsync(
        full(me, {
          ...v,
          name: (v.name ?? '').trim() || me.name,
          spec: (v.spec ?? '').trim(),
          exp: Math.max(0, +(v.exp ?? 0) || 0),
          city: (v.city ?? '').trim(),
          gym: (v.gym ?? '').trim(),
          about: (v.about ?? '').trim(),
        }),
      );
      setOpen(false);
      setD(null);
    } catch {
      setErr(t('Не удалось сохранить.'));
    }
  };
  return (
    <Card className="mb-2.5 gap-0" data-testid="my-prof">
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar t={me} size={48} />
        <span className="min-w-0 flex-1">
          <b className="block">{t('Мой профиль в каталоге')}</b>
          <span className="text-[0.78rem] text-muted-foreground">
            {miss ? (
              <span className="text-brand-orange">{t('Заполни профиль, чтобы клиенты тебя нашли')}</span>
            ) : (
              me.spec
            )}
          </span>
        </span>
        <ChevronDownIcon className={cn('size-5 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div className="mt-2.5 rounded-xl bg-[#1f1f1f] px-3 py-2 text-[0.78rem]">
        {me.partner ? (
          <span className="text-[#7BC67B]">
            ✓ {t('Партнёр FitBay: подписка бесплатна, клиенты по коду без комиссии')}
          </span>
        ) : (
          `${t('Подписка как у клиента')}: 9,99 €/${t('мес')}`
        )}
      </div>
      {open && (
        <>
          <Lbl htmlFor="tpName">{t('Имя')}</Lbl>
          <Input id="tpName" value={v.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
          <Lbl htmlFor="tpSpec">{t('Специализация')}</Lbl>
          <Input
            id="tpSpec"
            value={v.spec ?? ''}
            placeholder={t('Например: силовые, рекомпозиция')}
            onChange={(e) => set({ spec: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Lbl>{t('Пол')}</Lbl>
              <SingleToggle<'m' | 'f'>
                value={(v.sex || '') as 'm' | 'f' | ''}
                onChange={(x) => set({ sex: x })}
                aria-label={t('Пол')}
                options={[
                  { value: 'm', label: 'М' },
                  { value: 'f', label: 'Ж' },
                ]}
              />
            </div>
            <div>
              <Lbl htmlFor="tpExp">{t('Стаж, лет')}</Lbl>
              <Input
                id="tpExp"
                inputMode="numeric"
                value={v.exp ? String(v.exp) : ''}
                onChange={(e) => set({ exp: +e.target.value.replace(/\D/g, '') || 0 })}
              />
            </div>
          </div>
          <Lbl>{t('Образование')}</Lbl>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EDU).map(([k, n]) => {
              const on = (v.edu ?? []).includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({ edu: on ? (v.edu ?? []).filter((x) => x !== k) : [...(v.edu ?? []), k] })
                  }
                  className={cn(
                    'min-h-9 rounded-full bg-card px-3.5 text-[0.86rem]',
                    on ? 'bg-brand-cream font-semibold text-[#111]' : 'bg-[#262626]',
                  )}
                >
                  {t(n)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Lbl htmlFor="tpCity">{t('Город')}</Lbl>
              <Input id="tpCity" value={v.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
            </div>
            <div>
              <Lbl htmlFor="tpGym">{t('Зал')}</Lbl>
              <Input id="tpGym" value={v.gym ?? ''} onChange={(e) => set({ gym: e.target.value })} />
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-between text-[0.8rem] text-muted-foreground">
            {t('Провожу онлайн-тренировки')}
            <button
              type="button"
              aria-pressed={v.online !== false}
              aria-label={t('Провожу онлайн-тренировки')}
              onClick={() => set({ online: v.online === false })}
              className={cn(
                'relative h-7 w-[46px] flex-none rounded-full transition-colors',
                v.online !== false ? 'bg-brand-orange' : 'bg-[#333]',
              )}
            >
              <span
                className={cn(
                  'absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white transition-transform',
                  v.online !== false && 'translate-x-[18px]',
                )}
              />
            </button>
          </div>
          <Lbl htmlFor="tpAbout">{t('О себе')}</Lbl>
          <Textarea
            id="tpAbout"
            rows={3}
            value={v.about ?? ''}
            onChange={(e) => set({ about: e.target.value })}
          />
          <Button className="mt-3 w-full" disabled={ops.profile.isPending} onClick={() => void save()}>
            {t('Сохранить профиль')}
          </Button>
          {err && <p className="mt-2 text-sm text-brand-orange">{err}</p>}
          <div className="mt-2 text-[0.74rem] leading-snug text-muted-foreground">
            {t('Цена в каталоге берётся из твоих ставок в «Цены для генератора».')}
          </div>
        </>
      )}
    </Card>
  );
}

const normCode = (c?: string) =>
  String(c ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
const TR: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ж: 'ZH',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'H',
  Ц: 'C',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SH',
  Ы: 'Y',
  Э: 'E',
  Ю: 'YU',
  Я: 'YA',
};

/** refCardHtml + refAction прототипа: код партнёра для клиентов. */
function RefCard() {
  const { t } = useTranslation();
  const { data: me } = useMyTrainer();
  const { data: clients = [] } = useClients();
  const ops = useCabOps();
  const [msg, setMsg] = useState<Record<string, string>>({});
  if (!me?.partner) return null;
  const code = normCode(me.code);
  const n = clients.filter((c) => c.ref && normCode(c.ref) === code).length;
  const link = () => `${location.href.split('#')[0]}#ref=${code}`;
  const make = () => {
    const lat =
      [...String(me.name ?? '').toUpperCase()].map((ch) => TR[ch] ?? (/[A-Z]/.test(ch) ? ch : '')).join('') ||
      normCode(me.id);
    void ops.profile
      .mutateAsync(
        full(me, { code: (lat.slice(0, 8) || 'TRAINER') + String(10 + Math.floor(Math.random() * 90)) }),
      )
      .catch(() => {});
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* без буфера */
    }
    setMsg({ copy: t('Скопировано ✓') });
    setTimeout(() => setMsg({}), 1500);
  };
  const share = async () => {
    const txt = `${t('Мой код в FitBay')}: ${code}`;
    try {
      if (navigator.share) return await navigator.share({ text: txt, url: link() });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${txt} ${link()}`);
    } catch {
      /* без буфера */
    }
    setMsg({ share: t('Ссылка скопирована ✓') });
  };
  return (
    <Card className="mb-2.5 gap-0 bg-brand-yellow text-[#111]" data-testid="ref-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[0.72rem] font-semibold tracking-[0.06em] opacity-70">
            {t('ТВОЙ КОД ДЛЯ КЛИЕНТОВ')}
          </div>
          {code ? (
            <div className="mt-1 text-[1.8rem] font-extrabold tracking-[0.08em]">{code}</div>
          ) : (
            <div className="mt-1.5 text-[0.95rem]">{t('Кода пока нет')}</div>
          )}
        </div>
        {code && (
          <div className="text-right text-[0.8rem]">
            <b className="block text-[1.4rem]">{n}</b>
            {t('пришли по коду')}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {code ? (
          <>
            <Button variant="ghost" className="flex-1 bg-black/[.12] text-[#111]" onClick={() => void copy()}>
              {msg.copy || t('Скопировать')}
            </Button>
            <Button className="flex-1 bg-[#111] text-brand-yellow" onClick={() => void share()}>
              {msg.share || t('Поделиться')}
            </Button>
          </>
        ) : (
          <Button className="flex-1 bg-[#111] text-brand-yellow" onClick={make}>
            {t('Создать код')}
          </Button>
        )}
      </div>
      <div className="mt-2 text-[0.74rem] leading-snug opacity-70">
        {t(
          'Клиент вводит код в каталоге тренеров и сразу попадает к тебе. Данные он все равно откроет сам, с согласием.',
        )}
      </div>
    </Card>
  );
}

/** reqCardHtml + cabPkgClick прототипа: заявки на пакеты, принятие с числом занятий, ручное списание и возврат. */
function ReqCard() {
  const { t, i18n } = useTranslation();
  const { data: reqs = [] } = useTrainerReqs();
  const { data: slots = [] } = useMySlots();
  const ops = useCabOps();
  const [ans, setAns] = useState<Record<string, string>>({});
  const [sess, setSess] = useState<Record<string, string>>({});
  if (!reqs.length) return null;
  const L = reqs.filter((r) => r.status === 'new');
  const D = reqs
    .filter((r) => r.status !== 'new')
    .sort((a, b) => (a.status === 'accepted' ? 0 : 1) - (b.status === 'accepted' ? 0 : 1))
    .slice(0, 6);
  const answer = (r: PkgReq, accept: boolean) =>
    void ops.answer
      .mutateAsync({
        id: r.id,
        accept,
        answer: (ans[r.id] ?? '').trim(),
        sessions: Math.max(1, +(sess[r.id] ?? pkgSessDefault(r as unknown as PkgRequest)) || 1),
      })
      .catch(() => {});
  const adj = async (r: PkgReq, d: 1 | -1) => {
    if (
      !(await askConfirm(
        t(
          d > 0
            ? 'Списать одно занятие у клиента? Клиент получит уведомление.'
            : 'Вернуть клиенту одно занятие? Клиент получит уведомление.',
        ),
        t(d > 0 ? 'Списать' : 'Вернуть'),
        t('Отмена'),
      ))
    )
      return;
    await ops.adjust.mutateAsync({ id: r.id, d }).catch(() => {});
  };
  const row = (r: PkgReq) => (
    <div key={r.id} className="border-t border-[#2a2a2a] py-3" data-testid="req-row">
      <div className="flex justify-between gap-2">
        <b>{r.name || t('Клиент')}</b>
        <span className="text-[0.76rem] whitespace-nowrap text-muted-foreground">
          {fmtD(r.at, i18n.language)}
        </span>
      </div>
      <div className="mt-0.5 text-[0.84rem]">
        <span className="text-brand-yellow">{r.pkg?.name}</span>
        {r.pkg?.price ? ` · ${r.pkg.price}` : ''}
      </div>
      {r.msg && <div className="mt-1.5 text-[0.86rem] leading-snug opacity-85">{r.msg}</div>}
      <div className="mt-1 text-[0.82rem] text-muted-foreground">📞 {r.contact}</div>
      {r.status === 'new' ? (
        <>
          <div className="mt-2 flex items-center gap-2.5">
            <label htmlFor={`rs-${r.id}`} className="flex-1 text-[0.8rem] text-muted-foreground">
              {t('Занятий в пакете')}
            </label>
            <Input
              id={`rs-${r.id}`}
              className="w-20 text-center"
              inputMode="numeric"
              value={sess[r.id] ?? String(pkgSessDefault(r as unknown as PkgRequest))}
              onChange={(e) => setSess({ ...sess, [r.id]: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <Input
            className="mt-2"
            placeholder={t('Ответ клиенту (необязательно)')}
            value={ans[r.id] ?? ''}
            onChange={(e) => setAns({ ...ans, [r.id]: e.target.value })}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 text-brand-orange"
              disabled={ops.answer.isPending}
              onClick={() => answer(r, false)}
            >
              {t('Отклонить')}
            </Button>
            <Button className="flex-[1.3]" disabled={ops.answer.isPending} onClick={() => answer(r, true)}>
              {t('Принять')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div
            className="mt-1.5 text-[0.8rem]"
            style={{ color: r.status === 'accepted' ? '#7BC67B' : 'var(--orange)' }}
          >
            {t(r.status === 'accepted' ? 'Принята' : 'Отклонена')}
            {r.answer ? ` · ${r.answer}` : ''}
          </div>
          {r.status === 'accepted' && (
            <>
              <UsageBar u={pkgUsage(r as unknown as PkgRequest, slots, Date.now())} />
              {r.sessions && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="flex-1 text-[0.72rem] text-muted-foreground">
                    {t('Вручную')}
                    <br />
                    <span className="text-[0.66rem]">{t('клиент получит уведомление')}</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 text-[0.78rem]"
                    onClick={() => void adj(r, -1)}
                  >
                    ↩ {t('Вернуть занятие')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 text-[0.78rem]"
                    onClick={() => void adj(r, 1)}
                  >
                    ✓ {t('Списать занятие')}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
  return (
    <Card className="mb-2.5 gap-0" data-testid="req-card">
      <span className="text-sm text-muted-foreground">
        {t('Заявки на пакеты')}
        {L.length > 0 && (
          <span className="ml-1 rounded-full bg-brand-orange px-2 py-px text-[0.75rem] text-[#111]">
            {L.length}
          </span>
        )}
      </span>
      {L.map(row)}
      {D.length > 0 && <div className="mt-2 text-[0.74rem] text-muted-foreground">{t('Недавние')}</div>}
      {D.map(row)}
    </Card>
  );
}

type Vol = { min: string; pct: string };

/** myPkgCardHtml прототипа: мои пакеты и ставки генератора. */
function MyPkgCard() {
  const { t } = useTranslation();
  const { data: me } = useMyTrainer();
  const ops = useCabOps();
  const [open, setOpen] = useState(false);
  const [nw, setNw] = useState({ n: '', p: '', d: '' });
  const [err, setErr] = useState('');
  const [rt, setRt] = useState<{
    on: string;
    gym: string;
    food: string;
    d3: string;
    d6: string;
    vol: Vol[];
  } | null>(null);
  const [rtMsg, setRtMsg] = useState('');
  if (!me) return null;
  const P = me.packages ?? [];
  const r0 = me.rates ?? {};
  const R = rt ?? {
    on: String(r0.on ?? 40),
    gym: String(r0.gym ?? 60),
    food: String(r0.food ?? 50),
    d3: String(r0.dur?.[3] ?? 0),
    d6: String(r0.dur?.[6] ?? 0),
    vol: (r0.vol ?? []).length
      ? (r0.vol ?? []).map((v) => ({ min: String(v.min), pct: String(v.pct) }))
      : [{ min: '', pct: '' }],
  };
  const setR = (p: Partial<typeof R>) => (setRtMsg(''), setRt({ ...R, ...p }));
  const add = async () => {
    const n = nw.n.trim(),
      pr = nw.p.trim();
    if (!n || !pr) return setErr(t('Укажи название и цену.'));
    setErr('');
    await ops.profile
      .mutateAsync(
        full(me, { packages: [...P, { id: `p${Date.now()}`, name: n, price: pr, desc: nw.d.trim() }] }),
      )
      .catch(() => setErr(t('Не удалось сохранить.')));
    setNw({ n: '', p: '', d: '' });
  };
  const del = async (id: string) => {
    if (await askConfirm(t('Удалить пакет?')))
      await ops.profile.mutateAsync(full(me, { packages: P.filter((p) => p.id !== id) })).catch(() => {});
  };
  const saveRates = async () => {
    const num = (x: string) => (parseFloat(x) > 0 ? Math.round(parseFloat(x)) : 0);
    const rates = {
      on: num(R.on),
      gym: num(R.gym),
      food: num(R.food),
      dur: { 3: Math.max(0, Math.min(40, +R.d3 || 0)), 6: Math.max(0, Math.min(40, +R.d6 || 0)) },
      vol: R.vol
        .map((v) => ({ min: +v.min || 0, pct: +v.pct || 0 }))
        .filter((v) => v.min > 0 && v.pct > 0)
        .sort((a, b) => a.min - b.min),
    };
    try {
      await ops.profile.mutateAsync(full(me, { rates }));
      setRtMsg(t('Сохранено ✓'));
    } catch {
      setRtMsg(t('Не удалось сохранить.'));
    }
  };
  const nInput = (v: string, on: (x: string) => void, id?: string, ph?: string) => (
    <Input
      id={id}
      inputMode="decimal"
      value={v}
      placeholder={ph}
      onChange={(e) => on(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
    />
  );
  return (
    <Card className="mb-2.5 gap-0" data-testid="my-pkgs">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm text-muted-foreground">
          {t('Мои пакеты')} · {P.length}
        </span>
        <ChevronDownIcon className={cn('size-5 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          {P.map((p) => (
            <div key={p.id} className="flex items-start gap-2.5 border-t border-[#2a2a2a] py-2.5">
              <div className="min-w-0 flex-1">
                <b>{p.name}</b> <span className="text-brand-yellow">{p.price}</span>
                {p.desc && <div className="mt-0.5 text-[0.8rem] text-muted-foreground">{p.desc}</div>}
              </div>
              <Button
                variant="secondary"
                size="icon"
                aria-label={t('Удалить')}
                onClick={() => void del(p.id)}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
          <div className="border-t border-[#2a2a2a] pt-2.5">
            <Lbl htmlFor="pkN">{t('Название')}</Lbl>
            <Input
              id="pkN"
              value={nw.n}
              placeholder={t('Например: Техника, 3 тренировки')}
              onChange={(e) => setNw({ ...nw, n: e.target.value })}
            />
            <Lbl htmlFor="pkP">{t('Цена')}</Lbl>
            <Input
              id="pkP"
              value={nw.p}
              placeholder="100 €"
              onChange={(e) => setNw({ ...nw, p: e.target.value })}
            />
            <Lbl htmlFor="pkD">{t('Что входит')}</Lbl>
            <Textarea id="pkD" rows={2} value={nw.d} onChange={(e) => setNw({ ...nw, d: e.target.value })} />
            <Button className="mt-2.5 w-full" disabled={ops.profile.isPending} onClick={() => void add()}>
              {t('Добавить пакет')}
            </Button>
            {err && <p className="mt-2 text-sm text-brand-orange">{err}</p>}
          </div>
          <div className="mt-3.5 border-t border-[#2a2a2a] pt-2.5">
            <span className="text-sm text-muted-foreground">{t('Цены для генератора пакетов')}</span>
            <div className="text-[0.76rem] leading-snug text-muted-foreground">
              {t(
                'Клиент сам собирает пакет: частота, формат, срок, питание. Цена считается по этим ставкам.',
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['on', 'Онлайн, €'],
                  ['gym', 'Зал, €'],
                  ['food', 'Питание, €/мес'],
                ] as const
              ).map(([k, n]) => (
                <div key={k} className="min-w-0">
                  <label
                    htmlFor={`rt_${k}`}
                    className="mb-1 block truncate text-[0.72rem] text-muted-foreground"
                  >
                    {t(n)}
                  </label>
                  {nInput(R[k], (x) => setR({ [k]: x }), `rt_${k}`)}
                </div>
              ))}
            </div>
            <Lbl>{t('Скидка за срок, %')}</Lbl>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['d3', 3],
                  ['d6', 6],
                ] as const
              ).map(([k, m]) => (
                <div key={k}>
                  <label htmlFor={`rd_${m}`} className="mb-1 block text-[0.72rem] text-muted-foreground">
                    {m} {t('мес')}
                  </label>
                  {nInput(R[k], (x) => setR({ [k]: x }), `rd_${m}`)}
                </div>
              ))}
            </div>
            <Lbl>{t('Скидка за количество тренировок')}</Lbl>
            {R.vol.map((v, i) => (
              <div key={i} className="mt-1.5 flex items-center gap-2">
                <span className="text-[0.8rem] text-muted-foreground">{t('от')}</span>
                {nInput(
                  v.min,
                  (x) => setR({ vol: R.vol.map((y, j) => (j === i ? { ...y, min: x } : y)) }),
                  undefined,
                  '24',
                )}
                <span className="text-[0.8rem] text-muted-foreground">{t('трен.')}</span>
                {nInput(
                  v.pct,
                  (x) => setR({ vol: R.vol.map((y, j) => (j === i ? { ...y, pct: x } : y)) }),
                  undefined,
                  '5',
                )}
                <span className="text-[0.8rem] text-muted-foreground">%</span>
                <Button
                  variant="secondary"
                  size="icon"
                  className="flex-none"
                  aria-label={t('Удалить')}
                  onClick={() => setR({ vol: R.vol.filter((_, j) => j !== i) })}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              className="mt-1.5 w-full text-[0.85rem]"
              onClick={() => setR({ vol: [...R.vol, { min: '', pct: '' }] })}
            >
              {t('+ ещё порог')}
            </Button>
            <Button
              variant="secondary"
              className="mt-2.5 w-full"
              disabled={ops.profile.isPending}
              onClick={() => void saveRates()}
            >
              {rtMsg || t('Сохранить цены')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
