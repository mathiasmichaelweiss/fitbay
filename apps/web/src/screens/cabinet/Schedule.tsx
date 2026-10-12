import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SingleToggle } from '@/components/ui/toggle-group';
import { askConfirm, askReason } from '@/components/ui/confirm';
import { usePrograms } from '@/data/hooks';
import { useCabOps, useMySlots, type TSlot } from '@/data/cabinet';
import { useTrainer } from '@/data/trainers';
import { NoteView } from '@/screens/train/WorkoutSheet';
import { useEx } from '@/screens/train/exercises';
import { cn } from '@/lib/utils';
import { TrainerNoteEd } from './Workouts';

/** Расписание тренера (renderSched, openSlotForm, openPlan прототипа). */
const p2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const wkStart = (off: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
};
const monthDays = (sel: Date) => {
  const f = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const lead = (f.getDay() + 6) % 7;
  const n = new Date(sel.getFullYear(), sel.getMonth() + 1, 0).getDate();
  return [
    ...Array(lead).fill(null),
    ...[...Array(n)].map((_, i) => new Date(sel.getFullYear(), sel.getMonth(), i + 1)),
  ] as (Date | null)[];
};
const sv = (d: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    className="size-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

function useFmt() {
  const { i18n } = useTranslation();
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  return {
    L,
    fT: (ts: number) => new Date(ts).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' }),
    fD: (ts: number) =>
      new Date(ts).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' }),
    wd: (d: Date) => d.toLocaleDateString(L, { weekday: 'short' }).replace('.', ''),
  };
}

function usePlanNames() {
  const { db, name } = useEx();
  return (pl: TSlot['plan']) =>
    (pl?.items ?? []).map((i) => (db?.EXM[i.id] ? name(i.id) : i.name || '')).filter(Boolean);
}

export function Schedule() {
  const { t } = useTranslation();
  const { L, fT, fD, wd } = useFmt();
  const { data: slots = [] } = useMySlots();
  const ops = useCabOps();
  const names = usePlanNames();
  const now = Date.now();
  const [day, setDay] = useState(dayKey(now));
  const [wk, setWk] = useState(0);
  const [mon, setMon] = useState(false);
  const [form, setForm] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [tnOpen, setTnOpen] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const wkOf = (k: string) =>
    Math.floor((new Date(`${k}T12:00`).getTime() - wkStart(0).getTime()) / (7 * 864e5));

  const by: Record<string, TSlot[]> = {};
  slots.forEach((s) => (by[dayKey(s.start)] ??= []).push(s));
  const sel = new Date(`${day}T12:00`);
  const ds = (by[day] ?? []).slice().sort((a, b) => a.start - b.start);
  const hs = ds.map((s) => new Date(s.start).getHours());
  const h0 = Math.min(7, ...hs),
    h1 = Math.max(20, ...hs);
  const isToday = day === dayKey(now),
    nowH = new Date().getHours() + new Date().getMinutes() / 60;
  const ws = wkStart(wk);
  const days = [...Array(7)].map((_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
  const nx = slots
    .filter((x) => x.bookedBy && x.start + (x.dur || 60) * 6e4 > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4);

  const nav = (d: number) => {
    if (mon) {
      const dd = new Date(`${day}T12:00`);
      dd.setDate(1);
      dd.setMonth(dd.getMonth() + d);
      return setDay(dayKey(dd.getTime()));
    }
    const w = wk + d;
    setWk(w);
    setDay(w === 0 ? dayKey(now) : dayKey(wkStart(w).getTime()));
  };
  const pick = (k: string) => {
    setDay(k);
    setWk(wkOf(k));
  };
  const free = async (s: TSlot) => {
    const rs = await askReason(
      t('Отменить занятие клиента? Занятие останется у клиента в пакете, клиент получит уведомление.'),
      t('Отменить занятие'),
      t('Оставить'),
      t('Причина для клиента, например: заболел'),
    );
    if (rs !== null) await ops.cancel.mutateAsync({ id: s.id, reason: rs }).catch(() => {});
  };
  const del = async (s: TSlot) => {
    if (await askConfirm(t('Удалить свободный слот?'))) await ops.delSlot.mutateAsync(s.id).catch(() => {});
  };

  const card = (s: TSlot) => {
    const end = s.start + (s.dur || 60) * 6e4,
      bk = !!s.bookedBy,
      pn = names(s.plan);
    return (
      <div
        key={s.id}
        data-testid="slot"
        className={cn(
          'rounded-[18px] px-3.5 py-3',
          bk ? 'bg-brand-teal text-[#111]' : 'border-[1.5px] border-dashed border-[#3a3a3a] text-[#ddd]',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <b className="text-[1.02rem]">{bk ? s.bookedName || t('Клиент') : t('Свободно')}</b>
            <div className="mt-0.5 text-[0.78rem] opacity-70">
              {s.place === 'gym' ? s.addr || t('Зал') : t('Онлайн')}
            </div>
          </div>
          <button
            type="button"
            aria-label={t(bk ? 'Снять запись' : 'Удалить')}
            onClick={() => void (bk ? free(s) : del(s))}
            className="-m-2 grid size-11 flex-none place-items-center"
          >
            <span className="grid size-[30px] place-items-center rounded-full bg-[rgba(127,127,127,.15)]">
              {bk
                ? sv(<path d="M6 6l12 12M18 6L6 18" />)
                : sv(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />)}
            </span>
          </button>
        </div>
        {(s.plan?.items ?? []).length > 0 && (
          <div className="mt-2 text-[0.82rem] leading-snug">
            <b>{s.plan?.name}</b>
            <div className="opacity-75">
              {pn.slice(0, 4).join(' · ')}
              {pn.length > 4 ? ' …' : ''}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setPlan(s.id)}
          className={cn(
            'mt-2 min-h-9 rounded-full px-3 text-[0.8rem] font-semibold',
            bk ? 'bg-black/10' : 'bg-white/[.06]',
          )}
        >
          {s.plan ? t('Изменить план') : t('+ План тренировки')}
        </button>
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-[rgba(127,127,127,.25)] pt-2 text-[0.82rem]">
          {sv(
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </>,
          )}
          <span>
            {fT(s.start)} – {fT(end)}
          </span>
          {bk && (
            <span className="ml-auto grid size-7 place-items-center rounded-full bg-[#111] text-[0.8rem] font-bold text-brand-cream">
              {(s.bookedName || '?')[0]}
            </span>
          )}
        </div>
        {bk && s.start <= now && (
          <div className="mt-2.5 border-t border-[rgba(0,0,0,.15)] pt-2.5">
            {tnOpen[s.id] ? (
              <TrainerNoteEd s={s} compact />
            ) : s.tnote ? (
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setTnOpen({ ...tnOpen, [s.id]: true })}
              >
                <span className="text-[0.74rem] text-[#2b4b4b]">📝 {t('Твоя заметка')}</span>
                <NoteView o={s.tnote} />
              </button>
            ) : (
              <button
                type="button"
                className="min-h-9 text-[0.8rem] text-[#1b3a3a]"
                onClick={() => setTnOpen({ ...tnOpen, [s.id]: true })}
              >
                📝 {t('Заметка к занятию')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const rows = [];
  for (let h = h0; h <= h1; h++) {
    const ss = ds.filter((s) => new Date(s.start).getHours() === h);
    rows.push(
      <div
        key={h}
        className={cn('relative flex min-h-16 gap-2.5 py-2', h > h0 && 'border-t border-[#262626]')}
      >
        <div className="w-11 flex-none pt-0.5 text-[0.75rem] text-muted-foreground">{p2(h)}:00</div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">{ss.map(card)}</div>
        {isToday && nowH >= h && nowH < h + 1 && (
          <div
            className="pointer-events-none absolute right-0 left-11 h-0.5 bg-brand-orange"
            style={{ top: `${(nowH - h) * 100}%` }}
          />
        )}
      </div>,
    );
  }

  const dayBtn = (d: Date | null, i: number) => {
    if (!d) return <span key={`e${i}`} />;
    const k = dayKey(d.getTime()),
      Ls = by[k] ?? [],
      b = Ls.filter((x) => x.bookedBy).length,
      f = Ls.length - b;
    return (
      <button
        key={k}
        type="button"
        onClick={() => pick(k)}
        aria-pressed={k === day}
        className="flex flex-col items-center gap-1.5 rounded-[14px] pt-1.5 pb-1 text-[0.74rem] text-muted-foreground"
      >
        {!mon && <span className={cn(k === day && 'font-semibold text-white')}>{wd(d)}</span>}
        <b
          className={cn(
            'grid size-[38px] place-items-center rounded-xl text-[1.05rem] font-semibold text-[#ddd]',
            k === dayKey(now) && 'text-brand-orange',
            k === day && 'bg-brand-cream text-[#111]',
          )}
        >
          {d.getDate()}
        </b>
        <i className="flex h-[5px] gap-[3px]">
          {b > 0 && <em className="size-[5px] rounded-full bg-brand-teal" />}
          {f > 0 && <em className="size-[5px] rounded-full bg-[#555]" />}
        </i>
      </button>
    );
  };

  return (
    <div data-testid="sched" className="grid gap-3">
      <Card className="gap-0 px-3 pt-4 pb-2.5">
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            className="min-w-0 flex-1 overflow-hidden text-left"
            onClick={() => {
              if (mon) setWk(wkOf(day));
              setMon(!mon);
            }}
          >
            <div className="text-[0.75rem] text-muted-foreground">
              {mon ? t('Месяц') : t(wk === 0 ? 'Эта неделя' : wk > 0 ? 'Следующие недели' : 'Прошлые недели')}
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden text-[1.1rem] font-bold whitespace-nowrap">
              {mon ? (
                sel.toLocaleDateString(L, { month: 'long', year: 'numeric' })
              ) : (
                <span className="truncate">
                  {sel.toLocaleDateString(L, { day: 'numeric', month: 'long' })}{' '}
                  <span className="text-[0.85em] font-normal text-muted-foreground">
                    {sel.toLocaleDateString(L, { weekday: 'long' })}
                  </span>
                </span>
              )}
              <span
                className="inline-grid flex-none transition-transform duration-300"
                style={{ transform: `rotate(${mon ? 180 : 0}deg)` }}
              >
                {sv(<path d="M6 9l6 6 6-6" />)}
              </span>
            </div>
          </button>
          <button
            type="button"
            aria-label="‹"
            onClick={() => nav(-1)}
            className="grid size-11 place-items-center"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#262626] text-[#ddd]">
              {sv(<path d="M15 6l-6 6 6 6" />)}
            </span>
          </button>
          <button
            type="button"
            aria-label="›"
            onClick={() => nav(1)}
            className="grid size-11 place-items-center"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#262626] text-[#ddd]">
              {sv(<path d="M9 6l6 6-6 6" />)}
            </span>
          </button>
          <button
            type="button"
            aria-label={t('Добавить свободное время')}
            onClick={() => setForm(true)}
            className="ml-1 grid size-11 place-items-center rounded-[14px] bg-brand-orange text-[#111]"
          >
            {sv(<path d="M12 5v14M5 12h14" />)}
          </button>
        </div>
        {mon && (
          <div className="mt-3.5 grid grid-cols-7 gap-0.5 text-center text-[0.7rem] text-muted-foreground">
            {days.map((d) => (
              <span key={d.getTime()}>{wd(d)}</span>
            ))}
          </div>
        )}
        <div className={cn('grid grid-cols-7 gap-0.5', mon ? 'mt-1' : 'mt-3.5')}>
          {(mon ? monthDays(sel) : days).map(dayBtn)}
        </div>
      </Card>
      {nx.length > 0 && (
        <Card className="gap-0 px-3 pt-3.5 pb-1.5">
          <span className="mx-1 mb-1.5 text-sm text-muted-foreground">{t('Ближайшие занятия')}</span>
          {nx.map((x) => {
            const k = dayKey(x.start),
              tm = new Date(now + 864e5);
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  pick(k);
                  setMon(false);
                  setTimeout(
                    () => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    50,
                  );
                }}
                className="flex min-h-11 w-full items-center gap-2.5 border-t border-[#262626] px-1 py-2.5 first-of-type:border-t-0"
              >
                <span className="grid size-7 flex-none place-items-center rounded-full bg-brand-teal text-[0.8rem] font-bold text-[#111]">
                  {(x.bookedName || '?')[0]}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <b className="block truncate">{x.bookedName || t('Клиент')}</b>
                  <span className="text-[0.76rem] text-muted-foreground">
                    {(x.plan?.items ?? []).length
                      ? `${x.plan?.name || t('Тренировка')} · ${names(x.plan).length} ${t('упр.')} · `
                      : ''}
                    {x.place === 'gym' ? x.addr || t('Зал') : t('Онлайн')}
                  </span>
                </span>
                <span className="text-right whitespace-nowrap">
                  <b className="block">{fT(x.start)}</b>
                  <span
                    className={cn(
                      'text-[0.76rem]',
                      k === dayKey(now) ? 'text-brand-orange' : 'text-muted-foreground',
                    )}
                  >
                    {k === dayKey(now)
                      ? t('Сегодня')
                      : k === dayKey(tm.getTime())
                        ? t('Завтра')
                        : fD(x.start)}
                  </span>
                </span>
              </button>
            );
          })}
        </Card>
      )}
      <Card ref={listRef} className="scroll-mt-20 gap-0 px-3 py-1.5">
        {!ds.length && (
          <p className="m-0 px-1 pt-2.5 opacity-60">
            {t('В этот день слотов нет. Нажми +, чтобы добавить свободное время.')}
          </p>
        )}
        {rows}
      </Card>
      {form && <SlotForm day={day} onClose={() => setForm(false)} onDone={(k) => pick(k)} />}
      {plan && <PlanSheet id={plan} onClose={() => setPlan(null)} />}
    </div>
  );
}

const TIMES = [...Array(17 * 4)].map((_, i) => `${p2(6 + Math.floor(i / 4))}:${p2((i % 4) * 15)}`);

/** openSlotForm + addSlots прототипа. Дата и время через свои пикеры, без нативных полей. */
function SlotForm({
  day,
  onClose,
  onDone,
}: {
  day: string;
  onClose: () => void;
  onDone: (k: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: me } = useTrainer(null);
  const { data: slots = [] } = useMySlots();
  const ops = useCabOps();
  const [d, setD] = useState(day < dayKey(Date.now()) ? dayKey(Date.now()) : day);
  const [tm, setTm] = useState('18:00');
  const [dur, setDur] = useState('60');
  const [n, setN] = useState('1');
  const [place, setPlace] = useState<'online' | 'gym'>('online');
  const [addr, setAddr] = useState<string | null>(null);
  const [rep, setRep] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const a = addr ?? me?.gym ?? '';
  const add = async () => {
    setErr('');
    if (!d || !tm) return setErr(t('Выбери дату и время.'));
    const base = new Date(`${d}T${tm}`).getTime();
    if (base < Date.now()) return setErr(t('Это время уже прошло.'));
    const du = Math.max(15, +dur || 60),
      nn = Math.min(8, Math.max(1, +n || 1));
    setBusy(true);
    try {
      for (let w = 0; w < (rep ? 4 : 1); w++) {
        const st = base + w * 7 * 864e5;
        // как в прототипе: уже существующие слоты с тем же началом не дублируем
        if (slots.some((s) => s.start === st)) continue;
        await ops.addSlots.mutateAsync({
          start: st,
          dur: du,
          n: nn,
          place,
          addr: place === 'gym' ? a.trim() : '',
        });
      }
      onDone(d);
      onClose();
    } catch {
      setErr(t('Не удалось сохранить.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SheetPage open onOpenChange={(o) => !o && onClose()} title={t('Свободное время')}>
      <Card className="gap-0">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">{t('Дата')}</label>
            <DatePicker
              value={d}
              onChange={setD}
              lang={i18n.language}
              title={t('Дата')}
              min={dayKey(Date.now())}
              doneLabel={t('Готово')}
              aria-label={t('Дата')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">{t('Начало')}</label>
            <Select value={tm} onValueChange={setTm}>
              <SelectTrigger aria-label={t('Начало')} className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TIMES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="text-sm text-muted-foreground">
            {t('Длительность, мин')}
            <Input
              className="mt-1.5"
              inputMode="numeric"
              value={dur}
              onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="text-sm text-muted-foreground">
            {t('Слотов подряд')}
            <Input
              className="mt-1.5"
              inputMode="numeric"
              value={n}
              onChange={(e) => setN(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        <span className="mt-3 mb-1.5 text-sm text-muted-foreground">{t('Где')}</span>
        <SingleToggle<'online' | 'gym'>
          value={place}
          onChange={setPlace}
          options={[
            { value: 'online', label: t('Онлайн') },
            { value: 'gym', label: t('Зал') },
          ]}
        />
        {place === 'gym' && (
          <label className="mt-3 text-sm text-muted-foreground">
            {t('Адрес зала')}
            <Input className="mt-1.5" value={a} onChange={(e) => setAddr(e.target.value)} />
          </label>
        )}
        <label className="mt-3 flex min-h-11 items-center gap-2.5">
          <Checkbox checked={rep} onCheckedChange={(v) => setRep(v === true)} />
          <span>{t('Повторять 4 недели')}</span>
        </label>
      </Card>
      <Button className="w-full" onClick={() => void add()} disabled={busy}>
        {t('Добавить')}
      </Button>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </SheetPage>
  );
}

type PlanD = {
  name: string;
  note: string;
  items: { id: string; sets: number; reps: string; name?: string }[];
};

/** sh-plan прототипа (renderPlan): план тренировки к слоту. */
function PlanSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { fT, fD } = useFmt();
  const { data: slots = [] } = useMySlots();
  const { data: progs = [] } = usePrograms();
  const { db, name } = useEx();
  const ops = useCabOps();
  const s = slots.find((x) => x.id === id);
  const [d, setD] = useState<PlanD>(() => ({
    name: s?.plan?.name ?? '',
    note: s?.plan?.note ?? '',
    items: (s?.plan?.items ?? []).map((i) => ({ ...i, sets: i.sets ?? 3, reps: i.reps ?? '10' })),
  }));
  const [q, setQ] = useState('');
  if (!s) return null;
  const ql = q.trim().toLowerCase();
  const res =
    ql.length < 2 || !db
      ? []
      : db.EX.filter((x) => `${name(x)} ${x.n}`.toLowerCase().includes(ql)).slice(0, 8);
  const setIt = (i: number, p: Partial<PlanD['items'][number]>) =>
    setD({ ...d, items: d.items.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const save = async (plan: PlanD | null) => {
    await ops.plan
      .mutateAsync({ id, plan: plan ? { ...plan, name: plan.name.trim() || t('Тренировка') } : null })
      .catch(() => {});
    onClose();
  };
  return (
    <SheetPage open onOpenChange={(o) => !o && onClose()} title={t('План тренировки')}>
      <Card className="gap-0">
        <div className="text-[0.85rem] text-muted-foreground">
          {fD(s.start)}, {fT(s.start)} · {s.bookedBy ? s.bookedName || t('Клиент') : t('Свободно')}
        </div>
        <label className="mt-3 text-sm text-muted-foreground">
          {t('Название')}
          <Input
            className="mt-1.5"
            value={d.name}
            placeholder={t('Например: Ноги и ягодицы')}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        {progs.length > 0 && (
          <>
            <span className="mt-3 mb-1.5 text-sm text-muted-foreground">{t('Взять из моих программ')}</span>
            <div className="flex flex-wrap gap-1.5">
              {progs.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="min-h-9 rounded-full bg-[#262626] px-3 text-[0.82rem]"
                  onClick={() =>
                    setD({
                      ...d,
                      name: d.name || p.name,
                      items: p.items.map((i) => ({
                        id: i.id,
                        sets: i.sets || 3,
                        reps: String(i.reps || '10'),
                      })),
                    })
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
      </Card>
      <Card className="gap-0">
        <span className="mb-1 text-sm text-muted-foreground">{t('Упражнения')}</span>
        {d.items.length ? (
          d.items.map((x, i) => (
            <div key={i} className={cn('flex items-center gap-2 py-2', i > 0 && 'border-t border-[#2a2a2a]')}>
              <span className="min-w-0 flex-1 text-[0.92rem]">
                {db?.EXM[x.id] ? name(x.id) : x.name || ''}
              </span>
              <Input
                className="w-[52px] px-1 text-center"
                inputMode="numeric"
                aria-label={t('Подходы')}
                value={String(x.sets)}
                onChange={(e) => setIt(i, { sets: +e.target.value.replace(/\D/g, '') || 1 })}
              />
              <span className="text-muted-foreground">×</span>
              <Input
                className="w-16 px-1 text-center"
                aria-label={t('Повторы')}
                value={x.reps}
                onChange={(e) => setIt(i, { reps: e.target.value })}
              />
              <button
                type="button"
                aria-label={t('Удалить')}
                className="grid size-11 place-items-center text-muted-foreground"
                onClick={() => setD({ ...d, items: d.items.filter((_, k) => k !== i) })}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="text-[0.9rem] opacity-60">
            {t('Пока пусто. Найди упражнение ниже или возьми программу.')}
          </div>
        )}
        <Input
          className="mt-3"
          value={q}
          placeholder={t('Найти упражнение: присед, жим, тяга...')}
          onChange={(e) => setQ(e.target.value)}
        />
        {res.map((x) => (
          <button
            key={x.i}
            type="button"
            className="block min-h-11 w-full border-t border-[#2a2a2a] px-1 py-2.5 text-left"
            onClick={() => (setD({ ...d, items: [...d.items, { id: x.i, sets: 3, reps: '10' }] }), setQ(''))}
          >
            + {name(x)}
          </button>
        ))}
      </Card>
      <Card className="gap-0">
        <span className="mb-1.5 text-sm text-muted-foreground">{t('Что взять и как подготовиться')}</span>
        <Textarea
          rows={2}
          value={d.note}
          placeholder={t('Например: кроссовки, полотенце, поесть за 1,5 часа')}
          onChange={(e) => setD({ ...d, note: e.target.value })}
        />
      </Card>
      <Button className="w-full" disabled={ops.plan.isPending} onClick={() => void save(d)}>
        {t('Сохранить план')}
      </Button>
      {s.plan && (
        <Button variant="ghost" className="w-full text-brand-orange" onClick={() => void save(null)}>
          {t('Убрать план')}
        </Button>
      )}
    </SheetPage>
  );
}
