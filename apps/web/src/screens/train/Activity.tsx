import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import { woKcal } from '@fitbay/calc';
import type { ActivityEntry } from '@fitbay/shared';
import { Tile } from '@/components/ui/tile';
import { CapsRings } from '@/components/ui/rings';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { askConfirm } from '@/components/ui/confirm';
import { api, ApiError } from '@/data/api';
import { today, useActivities, useActivityOps, useProfile, useSaveProfile, useWorkoutOps, useWorkouts } from '@/data/hooks';
import { resizeImage } from '@/lib/image';

type Row = { id: string; wo?: boolean; name: string; kcal: number; min?: number; km?: number | null; steps?: number | null; src?: string };

/** actToday() прототипа: тренировки дня из журнала и активности. */
function useActToday(): Row[] {
  const { data: workouts = [] } = useWorkouts();
  const { data: acts = [] } = useActivities();
  const { data: profile } = useProfile();
  const d = today();
  const wo = workouts
    .filter((w) => w.date === d)
    .map((w) => ({ id: w.id, wo: true, name: w.title, kcal: woKcal(w.start, w.end, w.items, w.kcal, profile?.w), min: Math.round(Math.min(120, (w.end - w.start) / 60000)) }));
  return [...wo, ...acts.filter((x) => x.date === d)];
}

/** Плитка tAct прототипа: два круга, сожжено и активные минуты против целей дня. */
export function ActivityTile({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const A = useActToday();
  const k = A.reduce((a, x) => a + (+x.kcal || 0), 0);
  const m = A.reduce((a, x) => a + (+(x.min ?? 0) || 0), 0);
  const g = profile?.actGoal ?? { k: 400, m: 30 };
  return (
    <Tile full onClick={onOpen} data-testid="t-act" label={t('АКТИВНОСТЬ СЕГОДНЯ')}>
      <span aria-hidden className="absolute right-4 top-4 size-3 rounded-full bg-brand-orange" />
      <div className="mt-3 flex items-center gap-4">
        <CapsRings size={120} items={[{ v: k, g: g.k, c: '#FF5A0A' }, { v: m, g: g.m, c: '#7BC67B' }]} />
        <div>
          <b className="text-[1.3rem] text-[#FF5A0A]" data-testid="act-k">
            {k} / {g.k}
          </b>
          <div className="text-[0.8rem] opacity-60">{t('ккал сожжено')}</div>
          <div className="mt-2">
            <b className="text-[1.3rem] text-[#7BC67B]">
              {m} / {g.m}
            </b>
            <div className="text-[0.8rem] opacity-60">{t('активных минут')}</div>
          </div>
        </div>
      </div>
    </Tile>
  );
}

/** sh-act прототипа: список за сегодня, «+ Добавить активность», цели на день. */
export function ActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const A = useActToday();
  const { data: profile } = useProfile();
  const save = useSaveProfile();
  const { remove } = useActivityOps();
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [gk, setGk] = useState('');
  const [gm, setGm] = useState('');
  const g = profile?.actGoal ?? { k: 400, m: 30 };
  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Активность сегодня')}>
      <Card className="gap-0" data-testid="act-list">
        <span className="text-sm text-muted-foreground">{t('Сегодня')}</span>
        {A.length ? (
          A.map((x) => (
            <div key={x.id} className="flex items-center gap-2.5 border-t border-[#2a2a2a] py-2 first-of-type:border-t-0">
              <button type="button" className="min-h-11 flex-1 text-left" onClick={() => setEdit(x)}>
                <div className="font-semibold">{x.name}</div>
                <div className="text-[0.8rem] opacity-60">
                  {[
                    x.min ? `${x.min} ${t('мин')}` : '',
                    x.km ? `${x.km} km` : '',
                    x.steps ? `${Number(x.steps).toLocaleString(i18n.language)} ${t('шагов')}` : '',
                    x.wo ? t('тренировка из приложения') : x.src === 'shot' ? t('со скриншота') : '',
                    '✎',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
              <b>{x.kcal}</b>
              {!x.wo && (
                <button
                  type="button"
                  aria-label={t('Удалить')}
                  className="grid size-11 place-items-center opacity-50"
                  onClick={async () => {
                    if (await askConfirm(t('Удалить активность?'))) remove.mutate(x.id);
                  }}
                >
                  <XIcon className="size-5" />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="opacity-60">{t('Пока ничего.')}</div>
        )}
      </Card>
      <Button className="mt-3 w-full" onClick={() => setAdd(true)}>
        + {t('Добавить активность')}
      </Button>
      <Card className="mt-3 gap-2">
        <span className="text-sm text-muted-foreground">{t('Цели на день')}</span>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t('Сжечь, ккал')} type="number" inputMode="numeric" value={gk || String(g.k)} onChange={(e) => setGk(e.target.value)} />
          <Field label={t('Активных минут')} type="number" inputMode="numeric" value={gm || String(g.m)} onChange={(e) => setGm(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          className="h-12 w-full"
          onClick={() => {
            if (!profile) return;
            save.mutate({ ...profile, actGoal: { k: Math.max(50, +gk || g.k || 400), m: Math.max(5, +gm || g.m || 30) } });
            setGk('');
            setGm('');
          }}
        >
          {t('Сохранить цели')}
        </Button>
      </Card>
      <p className="mt-3 text-[0.78rem] leading-[1.45] text-muted-foreground">
        {t('Калории считаются примерно: по типу нагрузки (MET), длительности и твоему весу. Часы и приложения часто завышают расход, поэтому эти калории не добавляются к норме питания: обычная активность уже учтена в ней через число тренировок в неделю.')}
      </p>
      <ActivityAdd open={add} onClose={() => setAdd(false)} />
      <ActivityEdit row={edit} onClose={() => setEdit(null)} />
    </SheetPage>
  );
}

type Res = { rid: string | null; name: string; min: number; km: number | null; steps: number | null; kcal: number; on: boolean };
const toB64 = async (files: File[]) => Promise.all(files.map((f) => resizeImage(f, 1400, 0.85)));

/** sh-actadd прототипа: текстом или скриншотами, проверка перед добавлением, обновление уже записанной. */
function ActivityAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: acts = [] } = useActivities();
  const { create, update } = useActivityOps();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'text' | 'shot'>('');
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Res[]>([]);
  const [src, setSrc] = useState<'text' | 'shot'>('text');
  const file = useRef<HTMLInputElement>(null);
  const run = async (body: Record<string, unknown>, kind: 'text' | 'shot') => {
    setErr('');
    setBusy(kind);
    try {
      const r = await api.call<{ result: { items?: { name?: string; min?: number; km?: number; steps?: number; kcal?: number; replaceId?: string | null }[] } }>('POST', '/ai/activity', { ...body, lang: i18n.language, day: today() });
      const items = (r.result.items ?? []).map((x) => ({
        rid: x.replaceId && acts.some((a) => a.id === x.replaceId) ? x.replaceId : null,
        name: String(x.name ?? ''),
        min: Math.round(+(x.min ?? 0) || 0),
        km: x.km ? Math.round(x.km * 10) / 10 : null,
        steps: x.steps ? Math.round(x.steps) : null,
        kcal: Math.round(+(x.kcal ?? 0) || 0),
        on: true,
      }));
      if (!items.length) throw new Error('empty');
      setRes(items);
      setSrc(kind);
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? e.message : t('Не получилось разобрать, попробуй еще раз.'));
    } finally {
      setBusy('');
    }
  };
  const onFiles = async (F: File[]) => {
    if (!F.length) return;
    await run({ images: await toB64(F.slice(0, 5)) }, 'shot');
    if (F.length > 5) setErr(`${t('Обработаны первые')} 5 ${t('скриншотов, остальные добавь вторым заходом.')}`);
  };
  const saveAll = async () => {
    const now = Date.now();
    try {
      await Promise.all(
        res
          .filter((x) => x.on)
          .map((x, k) => {
            const d = { at: now + k, name: x.name, min: x.min, km: x.km, steps: x.steps, kcal: x.kcal };
            return x.rid ? update.mutateAsync({ id: x.rid, ...d }) : create.mutateAsync({ ...d, date: today(), src: src === 'shot' && !text.trim() ? 'shot' : 'text' });
          }),
      );
      setRes([]);
      setText('');
      onClose();
    } catch {
      /* как в прототипе: молча */
    }
  };
  const patch = (i: number, p: Partial<Res>) => setRes(res.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Добавить активность')}>
      <Card className="gap-2">
        <Label htmlFor="actText">{t('Словами или голосом')}</Label>
        <Textarea id="actText" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Например: прошел 8 км пешком, 40 минут на велосипеде, 10 000 шагов')} />
        <Button variant="secondary" className="h-12 w-full" disabled={!text.trim() || !!busy} onClick={() => run({ text: text.trim() }, 'text')}>
          {t(busy === 'text' ? 'Разбираю...' : 'Разобрать текст')}
        </Button>
        <span className="mt-2 text-sm text-muted-foreground">{t('Или скриншоты из других приложений')}</span>
        <Button variant="secondary" className="h-12 w-full" disabled={!!busy} onClick={() => file.current?.click()}>
          {busy === 'shot' ? t('Распознаю...') : t('📷 Выбрать скриншоты (можно несколько)')}
        </Button>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => (void onFiles([...(e.target.files ?? [])]), (e.target.value = ''))} />
        <div className="text-[0.78rem] text-muted-foreground">{t('Apple Health, Strava, часы и т. п. Если на скриншоте обновленный итог дня, запись обновится, а не задвоится.')}</div>
        {err && (
          <div role="alert" className="text-sm text-brand-orange">
            {err}
          </div>
        )}
      </Card>
      {res.length > 0 && (
        <Card className="mt-3 gap-0" data-testid="act-res">
          <span className="text-sm text-muted-foreground">{t('Проверь перед добавлением')}</span>
          {res.map((x, i) => (
            <div key={i} className="flex items-center gap-2 border-t border-[#2a2a2a] py-2" style={{ opacity: x.on ? 1 : 0.4 }}>
              <Checkbox checked={x.on} onCheckedChange={(v) => patch(i, { on: v === true })} aria-label={x.name} />
              <div className="min-w-0 flex-1">
                <Input value={x.name} onChange={(e) => patch(i, { name: e.target.value })} aria-label={t('Название')} className="h-10" />
                <div className="mt-1 text-[0.78rem] opacity-60">
                  {[
                    x.rid ? `↻ ${t('обновит запись')} «${acts.find((a) => a.id === x.rid)?.name ?? ''}»` : t('новая запись'),
                    x.min ? `${x.min} ${t('мин')}` : '',
                    x.km ? `${x.km} km` : '',
                    x.steps ? `${x.steps} ${t('шагов')}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <Input type="number" value={x.kcal} onChange={(e) => patch(i, { kcal: +e.target.value || 0 })} aria-label={t('Ккал')} className="h-10 w-20" />
            </div>
          ))}
          <Button className="mt-3 w-full" onClick={saveAll}>
            {t('Добавить активность')}
          </Button>
        </Card>
      )}
    </SheetPage>
  );
}

type EditF = { name: string; kcal: string; min: string; km: string; steps: string };

/** sh-actedit прототипа: правка цифр, обновление по скриншоту, удаление. Для тренировки из журнала: название, ккал, минуты. */
function ActivityEdit({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: workouts = [] } = useWorkouts();
  const aOps = useActivityOps();
  const wOps = useWorkoutOps();
  const [f, setF] = useState<EditF | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!row) return null;
  const v: EditF = f ?? { name: row.name, kcal: String(row.kcal || ''), min: String(row.min || ''), km: String(row.km || ''), steps: String(row.steps || '') };
  const set = (k: keyof EditF, x: string) => setF({ ...v, [k]: x });
  const num = (s: string) => {
    const n = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const close = () => (setF(null), setMsg(null), onClose());
  const save = async () => {
    try {
      if (row.wo) {
        const w = workouts.find((x) => x.id === row.id);
        if (!w) return;
        const mn = Math.max(1, Math.round(num(v.min) || 1));
        await wOps.update.mutateAsync({ id: row.id, title: v.name.trim() || t('Тренировка'), kcal: Math.round(num(v.kcal) || 0), end: w.start + mn * 60000 });
      } else {
        const st = num(v.steps);
        await aOps.update.mutateAsync({ id: row.id, name: v.name.trim() || t('Активность'), kcal: Math.round(num(v.kcal) || 0), min: Math.round(num(v.min) || 0), km: num(v.km), steps: st ? Math.round(st) : null } as Partial<ActivityEntry> & { id: string });
      }
      close();
    } catch {
      /* как в прототипе: молча */
    }
  };
  const shots = async (F: File[]) => {
    if (!F.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.call<{ result: { min?: number; km?: number; steps?: number; kcal?: number } }>('POST', '/ai/activity', { mode: 'edit', cur: v, images: await toB64(F.slice(0, 5)), lang: i18n.language, day: today() });
      const x = r.result;
      setF({
        ...v,
        ...(x.min != null ? { min: String(Math.round(x.min)) } : {}),
        ...(x.km != null ? { km: String(Math.round(x.km * 10) / 10) } : {}),
        ...(x.steps != null ? { steps: String(Math.round(x.steps)) } : {}),
        ...(x.kcal != null ? { kcal: String(Math.round(x.kcal)) } : {}),
      });
      setMsg({ ok: true, text: t('Цифры обновлены, проверь и нажми «Сохранить изменения».') });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError && e.status === 429 ? e.message : t('Не получилось разобрать, попробуй еще раз.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SheetPage open onOpenChange={(o) => !o && close()} title={`${row.name || t('Активность')}: ${t('изменить')}`}>
      <Card className="gap-3">
        <Field label={t('Название')} value={v.name} onChange={(e) => set('name', e.target.value)} />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t('Ккал')} type="number" inputMode="numeric" value={v.kcal} onChange={(e) => set('kcal', e.target.value)} />
          <Field label={t('Минут')} type="number" inputMode="numeric" value={v.min} onChange={(e) => set('min', e.target.value)} />
        </div>
        {!row.wo && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label={t('Км')} type="number" inputMode="decimal" step="0.1" value={v.km} onChange={(e) => set('km', e.target.value)} />
              <Field label={t('Шаги')} type="number" inputMode="numeric" value={v.steps} onChange={(e) => set('steps', e.target.value)} />
            </div>
            <Button variant="secondary" className="h-12 w-full" disabled={busy} onClick={() => file.current?.click()}>
              {busy ? t('Распознаю...') : t('📷 Обновить цифры по скриншоту')}
            </Button>
            <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => (void shots([...(e.target.files ?? [])]), (e.target.value = ''))} />
          </>
        )}
        {msg && (
          <div role="alert" className="text-sm" style={{ color: msg.ok ? '#7BC67B' : 'var(--orange)' }}>
            {msg.text}
          </div>
        )}
      </Card>
      <Button className="mt-4 w-full" onClick={save}>
        {t('Сохранить изменения')}
      </Button>
      <Button
        variant="outline"
        className="mt-2.5 h-[52px] w-full rounded-lg border-[#333] text-brand-orange"
        onClick={async () => {
          if (!(await askConfirm(t(row.wo ? 'Удалить тренировку из истории?' : 'Удалить активность?')))) return;
          if (row.wo) wOps.remove.mutate(row.id);
          else aOps.remove.mutate(row.id);
          close();
        }}
      >
        {t('Удалить активность')}
      </Button>
    </SheetPage>
  );
}
