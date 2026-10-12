import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pvf, toggleTag } from '@fitbay/calc';
import type { Workout } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCabOps, useClients, useMySlots, type Client, type ClWorkout, type TSlot } from '@/data/cabinet';
import { useTrainer } from '@/data/trainers';
import { NoteView } from '@/screens/train/WorkoutSheet';
import { PlanFact } from '@/screens/train/History';
import { useEx } from '@/screens/train/exercises';
import { useTrain } from '@/screens/train/store';
import { cn } from '@/lib/utils';

/** Тренер: тренировки клиента карточками, лист тренировки и запуск занятия (clWoHtml, renderWod, trStartFor прототипа). */
export type WodKey = `own:${number}` | `joint:${string}`;

const WCOL: Record<string, string> = {
  pain: '#e5484d',
  hard: '#FF8A3D',
  tech: '#5B8DEF',
  easy: '#7BC67B',
  note: '#5BC0BE',
};
type WoLike = { tags?: string[]; note?: string; items?: { tags?: string[]; note?: string }[] };
const woKind = (o: WoLike) => {
  const T2 = [...(o.tags ?? []), ...(o.items ?? []).flatMap((i) => i.tags ?? [])];
  for (const k of ['pain', 'hard', 'tech', 'easy']) if (T2.includes(k)) return k;
  return o.note || (o.items ?? []).some((i) => i.note) ? 'note' : null;
};
export const slotLive = (x: TSlot) => {
  const now = Date.now();
  return !!x.live?.start || (!x.session && x.start <= now && now < x.start + (x.dur || 60) * 6e4);
};
const pcol = (p: number) => (p >= 95 ? '#7BC67B' : p >= 70 ? '#FF8A3D' : '#e5484d');
const asW = (w: ClWorkout) => w as unknown as Workout;

function useJoint() {
  const { t } = useTranslation();
  return (x: TSlot) => {
    const se = x.session,
      tn = x.tnote;
    return {
      title: x.plan?.name || se?.title || t('Тренировка с тренером'),
      items: se?.items ?? [],
      tags: [...new Set([...(se?.tags ?? []), ...(tn?.tags ?? [])])],
      note: [se?.note, tn?.note].filter(Boolean).join(' · '),
      min: se?.end ? Math.round((se.end - se.start) / 6e4) : x.dur || 60,
    };
  };
}

const useLoc = () => {
  const { i18n } = useTranslation();
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  return {
    L,
    when: (ts: number) =>
      `${new Date(ts).toLocaleDateString(L, { day: 'numeric', month: 'short' })}, ${new Date(ts).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' })}`,
  };
};

/** trStartFor(cid, slotId) прототипа: занятие по слоту (или разовый слот сейчас), live, своя тренировка паркуется. */
export function useTrStart() {
  const { t } = useTranslation();
  const { data: slots = [] } = useMySlots();
  const { data: clients = [] } = useClients();
  const { data: me } = useTrainer(null);
  const ops = useCabOps();
  const { db } = useEx();
  return async (cid: string, slotId: string | null) => {
    const c = clients.find((x) => x.id === cid);
    if (!c) return;
    const now = Date.now();
    const tr = useTrain.getState();
    let x = slotId
      ? slots.find((y) => y.id === slotId)
      : slots.find(
          (y) =>
            y.bookedBy === cid && !y.session && y.start - 36e5 < now && now < y.start + (y.dur || 60) * 6e4,
        );
    if (tr.active?.forClient && x && tr.active.forClient.slot === x.id)
      return useTrain.setState({ wo: true });
    if (!x) {
      const r = await ops.adhoc
        .mutateAsync({ start: now, bookedBy: cid, addr: me?.gym || '' })
        .catch(() => null);
      x = r?.items?.[0];
      if (!x) return;
    }
    await ops.live.mutateAsync({ id: x.id, on: true }).catch(() => {});
    const parked = tr.active && !tr.active.forClient ? tr.active : tr.parked;
    useTrain.setState({ parked });
    tr.setActive({
      forClient: { id: cid, name: c.name, slot: x.id },
      title: x.plan?.name || t('Тренировка с клиентом'),
      start: now,
      progId: null,
      items: (x.plan?.items ?? [])
        .filter((i) => db?.EXM[i.id])
        .map((i) => ({
          id: i.id,
          target: i.reps || '',
          sets: Array.from({ length: +(i.sets ?? 0) || 3 }, () => ({ r: '', w: '', d: false })),
        })),
    });
    useTrain.setState({ wo: true });
  };
}

/** trFinishFor(a, cancel) прототипа: итог занятия уходит в слот, своя тренировка возвращается. */
export function useTrFinish() {
  const ops = useCabOps();
  return async (a: NonNullable<ReturnType<typeof useTrain.getState>['active']>, items: unknown[] | null) => {
    const f = a.forClient;
    if (!f?.slot) return;
    const now = Date.now();
    if (items) {
      await ops.session.mutateAsync({
        id: f.slot,
        session: {
          title: a.title || '',
          start: a.start,
          end: now,
          items,
          tags: a.tags ?? [],
          note: (a.note ?? '').trim(),
        },
      });
    } else await ops.live.mutateAsync({ id: f.slot, on: false }).catch(() => {});
    const s = useTrain.getState();
    s.setActive(s.parked || null);
    useTrain.setState({ parked: null, wo: false });
  };
}

/** clWoHtml(c) прототипа. */
export function WorkoutsSection({ c, onOpen }: { c: Client; onOpen: (k: WodKey) => void }) {
  const { t } = useTranslation();
  const { L, when } = useLoc();
  const { data: slots = [] } = useMySlots();
  const joint = useJoint();
  const start = useTrStart();
  const now = Date.now();
  const list = [
    ...c.workouts.map((w, i) => ({
      k: 'own' as const,
      i,
      ts: w.at || new Date(`${w.date}T18:00`).getTime(),
      w,
    })),
    ...slots
      .filter((x) => x.bookedBy === c.id && !x.cancel && (x.start <= now || x.live))
      .map((x) => ({ k: 'joint' as const, id: x.id, ts: x.start, x })),
  ].sort((a, b) => b.ts - a.ts);
  const byW: Record<number, number[]> = {};
  c.workouts.forEach((w) => {
    const r = pvf(asW(w));
    if (r?.week) (byW[r.week] ??= []).push(r.pct);
  });
  const wk = Object.keys(byW)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 6);
  return (
    <>
      <Button className="mb-3 w-full" onClick={() => void start(c.id, null)}>
        ▶ {t('Начать тренировку с клиентом')}
      </Button>
      {wk.length > 0 && (
        <Card className="gap-0">
          <span className="text-sm text-muted-foreground">{t('План и факт по неделям')}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {wk.map((n) => {
              const B = byW[n] ?? [];
              const a = Math.round(B.reduce((x, y) => x + y, 0) / (B.length || 1));
              return (
                <div key={n} className="min-w-[70px] flex-1 rounded-xl bg-[#222] px-2.5 py-2">
                  <div className="text-[0.7rem] text-muted-foreground">
                    {t('Неделя')} {n}
                  </div>
                  <b style={{ color: pcol(a) }}>{a}%</b>
                  <div className="text-[0.68rem] text-muted-foreground">
                    {B.length} {t('трен.')}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {list.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {list.map((e) => {
            const own = e.k === 'own';
            const d = own ? e.w : joint(e.x);
            const kd = woKind(d);
            const live = !own && slotLive(e.x);
            const p = own ? pvf(asW(e.w)) : null;
            const tags = [...new Set([...(d.tags ?? []), ...(d.items ?? []).flatMap((i) => i.tags ?? [])])];
            return (
              <button
                key={own ? `o${e.i}` : e.id}
                type="button"
                data-testid="woc"
                onClick={() => onOpen(own ? `own:${e.i}` : `joint:${e.id}`)}
                className={cn(
                  'flex min-h-11 items-center gap-3 overflow-hidden rounded-2xl bg-card p-3 pl-0 text-left',
                  live && 'ring-1 ring-brand-orange',
                )}
              >
                <span
                  className="w-1 self-stretch rounded-r"
                  style={{ background: kd ? WCOL[kd] : 'transparent' }}
                />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{d.title || t('Тренировка')}</b>
                  <span className="block text-[0.78rem] text-muted-foreground">
                    {own
                      ? new Date(`${e.w.date}T12:00`).toLocaleDateString(L, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })
                      : when(e.x.start)}{' '}
                    · {own ? e.w.min : d.min} {t('мин')}
                    {own ? ` · ${e.w.items.length} ${t('упр.')}` : ''}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1 text-[0.7rem]">
                    {p && (
                      <i
                        className="rounded-full bg-white/[.06] px-2 py-0.5 not-italic"
                        style={{ color: pcol(p.pct) }}
                      >
                        {t('план')} {p.pct}%
                      </i>
                    )}
                    {!own && (
                      <i className="rounded-full bg-white/[.06] px-2 py-0.5 not-italic">
                        🤝 {t('с тренером')}
                      </i>
                    )}
                    {live && (
                      <i className="rounded-full bg-[rgba(255,90,10,.16)] px-2 py-0.5 not-italic text-brand-orange">
                        ● {t('в процессе')}
                      </i>
                    )}
                    {tags.length > 0 && <NoteView o={{ tags }} />}
                    {kd === 'note' && <span>💬</span>}
                  </span>
                </span>
                <span className="opacity-40">›</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 opacity-60">{t('Нет тренировок.')}</p>
      )}
    </>
  );
}

function ExRow({
  i,
}: {
  i: { id?: string | null; name?: string; sets?: { r: number; w: number }[]; tags?: string[]; note?: string };
}) {
  const { db, name } = useEx();
  return (
    <div className="border-t border-[#2a2a2a] py-2">
      <div className="flex justify-between gap-2">
        <span>{i.id && db?.EXM[i.id] ? name(i.id) : i.name}</span>
        <span className="text-right text-[0.86rem] text-muted-foreground">
          {(i.sets ?? []).map((x) => x.r + (x.w ? `×${x.w}` : '')).join(', ')}
        </span>
      </div>
      <NoteView o={i} />
    </div>
  );
}

export function PlanList({ plan }: { plan: TSlot['plan'] }) {
  const { db, name } = useEx();
  return (
    <>
      {(plan?.items ?? []).map((x, i) => (
        <div key={i} className={cn('flex items-center gap-2.5 py-2', i > 0 && 'border-t border-[#2a2a2a]')}>
          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-[#262626] text-[0.72rem]">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">{db?.EXM[x.id] ? name(x.id) : x.name || ''}</span>
          <span className="whitespace-nowrap text-[0.85rem] text-muted-foreground">
            {x.sets || 3}×{x.reps || '10'}
          </span>
        </div>
      ))}
    </>
  );
}

/** tnEdHtml(id) прототипа: метки и заметка тренера к занятию. */
export function TrainerNoteEd({ s, compact }: { s: TSlot; compact?: boolean }) {
  const { t } = useTranslation();
  const { db } = useEx();
  const ops = useCabOps();
  const [d, setD] = useState({ tags: [...(s.tnote?.tags ?? [])], note: s.tnote?.note ?? '' });
  const [saved, setSaved] = useState(false);
  return (
    <div>
      {compact && (
        <div className="mb-1.5 text-[0.74rem] text-muted-foreground">
          {t('Заметка к занятию (клиент тоже увидит)')}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {db?.WTAGS.map(([k, ic, n]) => {
          const on = d.tags.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => (setSaved(false), setD({ ...d, tags: toggleTag(d.tags, k) }))}
              className={cn(
                'min-h-9 rounded-full bg-white/[.06] px-2.5 py-1.5 text-[0.76rem] text-[#ddd]',
                on && 'bg-brand-teal font-bold text-[#111]',
                on && k === 'pain' && 'bg-[#e5484d] text-white',
              )}
            >
              {ic} {t(n)}
            </button>
          );
        })}
      </div>
      <Textarea
        rows={compact ? 2 : 3}
        className="mt-2"
        value={d.note}
        aria-label={t('Заметка тренера')}
        placeholder={t('Например: жаловался на плечо, жим снизили до 40 кг')}
        onChange={(e) => (setSaved(false), setD({ ...d, note: e.target.value }))}
      />
      {!compact && (
        <div className="mt-1 text-[0.74rem] text-muted-foreground">{t('Клиент тоже увидит заметку')}</div>
      )}
      <Button
        className="mt-2 w-full"
        disabled={ops.note.isPending || saved}
        onClick={() =>
          void ops.note
            .mutateAsync({ id: s.id, tags: d.tags, note: d.note.trim() })
            .then(() => setSaved(true))
        }
      >
        {t(saved ? 'Сохранено ✓' : 'Сохранить заметку')}
      </Button>
    </div>
  );
}

/** sh-wod прототипа (renderWod). */
export function WodSheet({ c, k, onClose }: { c: Client; k: WodKey; onClose: () => void }) {
  const { t } = useTranslation();
  const { L, when } = useLoc();
  const { data: slots = [] } = useMySlots();
  const joint = useJoint();
  const start = useTrStart();
  const [kind, id] = k.split(':') as ['own' | 'joint', string];
  if (kind === 'own') {
    const w = c.workouts[+id];
    if (!w) return null;
    return (
      <SheetPage open onOpenChange={(o) => !o && onClose()} title={w.title || t('Тренировка')}>
        <Card className="gap-0">
          <div className="text-[0.85rem] text-muted-foreground">
            {new Date(`${w.date}T12:00`).toLocaleDateString(L, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            · {w.min} {t('мин')} · ~{w.kcal} kcal · {t('сам, без тренера')}
          </div>
          {(w.tags.length > 0 || w.note) && (
            <>
              <span className="mt-3 text-sm text-muted-foreground">{t('Комментарий клиента')}</span>
              <NoteView o={w} />
            </>
          )}
        </Card>
        <PlanFact w={asW(w)} />
        <Card className="gap-0">
          <span className="mb-1 text-sm text-muted-foreground">{t('Упражнения')}</span>
          {w.items.map((i, n) => (
            <ExRow key={n} i={i} />
          ))}
        </Card>
      </SheetPage>
    );
  }
  const x = slots.find((y) => y.id === id);
  if (!x) return null;
  const d = joint(x),
    live = slotLive(x);
  return (
    <SheetPage open onOpenChange={(o) => !o && onClose()} title={d.title}>
      <Card className="gap-0">
        <div className="text-[0.85rem] text-muted-foreground">
          {when(x.start)} · {x.place === 'gym' ? x.addr || t('Зал') : t('Онлайн')} · 🤝 {t('с тренером')}
        </div>
        {live && (
          <div className="mt-2 inline-block w-fit rounded-full bg-[rgba(255,90,10,.16)] px-2 py-0.5 text-[0.75rem] text-brand-orange">
            ● {t('в процессе')}
          </div>
        )}
        {!x.session && (
          <Button className="mt-3 w-full" onClick={() => void start(c.id, x.id).then(onClose)}>
            ▶ {t(live && x.live ? 'Продолжить тренировку' : 'Начать тренировку')}
          </Button>
        )}
      </Card>
      {d.items.length ? (
        <Card className="gap-0">
          <span className="mb-1 text-sm text-muted-foreground">{t('Выполнено')}</span>
          {d.items.map((i, n) => (
            <ExRow key={n} i={i} />
          ))}
        </Card>
      ) : (x.plan?.items ?? []).length ? (
        <Card className="gap-0">
          <span className="mb-1 text-sm text-muted-foreground">{t('План занятия')}</span>
          <PlanList plan={x.plan} />
        </Card>
      ) : null}
      <Card className="gap-0">
        <span className="mb-2 text-sm text-muted-foreground">📝 {t('Заметка тренера')}</span>
        <TrainerNoteEd s={x} />
      </Card>
    </SheetPage>
  );
}
