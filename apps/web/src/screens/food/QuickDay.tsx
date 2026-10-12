import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SLOTS, type Meal, type Slot } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SheetPage } from '@/components/ui/sheet-page';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/data/api';
import { today, useMealOps, useRecipeOps, useRecipes } from '@/data/hooks';
import { SLOTN } from '@/lib/meals';
import { p100, SLOT_H } from './logic';

/** «Рассказать про день» (sh-quick прототипа): qGo → разбор ИИ, renderQ, qSave. */
type Q = { slot: Slot; name: string; recId: string | null; grams?: number; kcal: number; protein: number; fat: number; carbs: number; desc?: string; thumb?: string; on: boolean };

export function QuickDay({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'de' ? 'de' : 'ru';
  const { data: recs = [] } = useRecipes();
  const recipeOps = useRecipeOps();
  const { create } = useMealOps();
  const [txt, setTxt] = useState('');
  const [items, setItems] = useState<Q[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setTxt('');
    setItems([]);
    setErr('');
    onClose();
  };

  const go = async () => {
    setErr('');
    if (!txt.trim()) return setErr(t('Напиши или надиктуй, что ел.'));
    setBusy(true);
    try {
      const r = await api.call<{ result: { items?: Record<string, unknown>[] } }>('POST', '/ai/day_story', { text: txt.trim(), lang, day: date });
      const out: Q[] = (r.result.items ?? []).map((x) => {
        const rec = x.recId ? recs.find((z) => z.id === x.recId) : undefined;
        const slot = (SLOTS.includes(x.slot as Slot) ? x.slot : 'snack') as Slot;
        if (rec) {
          const h = p100(rec);
          const g = +(x.grams as number) || rec.grams || 100;
          if (h)
            return { slot, recId: rec.id, name: rec.name, grams: g, kcal: Math.round((h.kcal * g) / 100), protein: Math.round((h.protein * g) / 100), fat: Math.round((h.fat * g) / 100), carbs: Math.round((h.carbs * g) / 100), thumb: rec.thumb, desc: rec.desc, on: true };
          return { slot, recId: rec.id, name: rec.name, grams: rec.grams ?? undefined, kcal: rec.kcal, protein: rec.protein, fat: rec.fat, carbs: rec.carbs, thumb: rec.thumb, desc: rec.desc, on: true };
        }
        return { slot, recId: null, name: String(x.name ?? ''), grams: +(x.grams as number) || undefined, kcal: Math.round(+(x.kcal as number) || 0), protein: Math.round(+(x.protein as number) || 0), fat: Math.round(+(x.fat as number) || 0), carbs: Math.round(+(x.carbs as number) || 0), desc: String(x.desc ?? ''), on: true };
      });
      if (!out.length) throw new Error();
      setItems(out);
    } catch (e) {
      setErr(e instanceof ApiError && (e.status === 429 || e.status === 503) ? t(e.message) : t('Не получилось разобрать, попробуй еще раз.'));
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    const L = items.filter((x) => x.on);
    if (!L.length || date > today()) return;
    const cnt: Record<string, number> = {};
    try {
      for (const [i, x] of L.entries()) {
        cnt[x.slot] = (cnt[x.slot] || 0) + 1;
        const d = new Date(`${date}T00:00:00`);
        d.setHours(SLOT_H[x.slot] || 12, cnt[x.slot]! * 2, 0, 0);
        let ts = d.getTime();
        if (date === today() && ts > Date.now()) ts = Date.now() - 60000 * (L.length - i);
        const m: Omit<Meal, 'id'> = {
          date, ts, name: x.name, dish: x.name, desc: x.desc || '', kcal: x.kcal, protein: x.protein, fat: x.fat, carbs: x.carbs,
          grams: x.grams ? Math.round(x.grams) : undefined, plate: { type: 'none' }, confidence: x.recId ? t('сохранено') : t('средняя'),
          thumb: x.thumb || '', recId: x.recId, slot: x.slot,
        };
        await create.mutateAsync(m);
        if (x.recId) {
          const r = recs.find((z) => z.id === x.recId);
          if (r) recipeOps.update.mutate({ id: r.id, used: (r.used || 0) + 1 });
        }
      }
      close();
    } catch {
      setErr(t('Не удалось сохранить.'));
    }
  };

  const sum = items.filter((x) => x.on).reduce((a, x) => a + x.kcal, 0);
  const E = lang === 'de' ? ['E', 'F', 'KH'] : ['Б', 'Ж', 'У'];

  return (
    <SheetPage open={open} onOpenChange={(o) => !o && close()} title={t('Рассказать про день')}>
      <div className="rounded-xl bg-card p-4">
        <label htmlFor="q-text" className="mb-1.5 block text-[0.8rem] text-muted-foreground">
          {t('Что ел сегодня')}
        </label>
        <textarea
          id="q-text"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder={t('Например: на завтрак омлет из трех яиц, на обед лосось с рисом, днем протеиновый батончик, на ужин гречка с курицей')}
          className="min-h-[130px] w-full rounded-md border bg-secondary px-[13px] py-[11px] outline-none focus-visible:border-ring"
        />
        <div className="mt-1.5 text-[0.8rem] text-muted-foreground">{t('Можно надиктовать микрофоном на клавиатуре. Блюда из книги рецептов подтянутся оттуда.')}</div>
      </div>
      {err && <p role="alert" className="mt-2 text-[0.88rem] text-brand-orange">{err}</p>}
      <Button className="mt-3.5 w-full" disabled={busy} onClick={go}>
        {busy ? t('Разбираю...') : t('Разобрать')}
      </Button>

      {!!items.length && (
        <div className="mt-3 rounded-xl bg-card p-4">
          {items.map((x, i) => (
            <div key={i} data-testid="q-row" className={cn('border-t border-[#2a2a2a] py-2.5 first:border-t-0', !x.on && 'opacity-40')}>
              <div className="flex items-center gap-2.5">
                <Checkbox aria-label={x.name} checked={x.on} onCheckedChange={(v) => setItems((L) => L.map((y, j) => (j === i ? { ...y, on: v === true } : y)))} />
                <input value={x.name} aria-label={t('Название')} onChange={(e) => setItems((L) => L.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className="h-10 min-w-0 flex-1 rounded-md border bg-secondary px-2.5" />
                <b className="whitespace-nowrap">{x.kcal}</b>
              </div>
              <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                {SLOTS.map((k) => (
                  <button key={k} type="button" aria-pressed={x.slot === k} onClick={() => setItems((L) => L.map((y, j) => (j === i ? { ...y, slot: k } : y)))} className={cn('rounded-full bg-secondary px-2.5 py-1.5 text-[0.8rem]', x.slot === k && 'bg-primary text-on-color')}>
                    {t(SLOTN[k])}
                  </button>
                ))}
              </div>
              <div className="ml-8 mt-1.5 text-[0.78rem] opacity-60">
                {x.recId ? `📖 ${t('из книги рецептов')} · ` : ''}
                {x.grams ? `${Math.round(x.grams)} г · ` : ''}
                {E[0]} {x.protein} · {E[1]} {x.fat} · {E[2]} {x.carbs}
              </div>
            </div>
          ))}
          <Button className="mt-3 w-full" onClick={saveAll}>
            {t('Добавить в дневник')} ({sum} kcal)
          </Button>
          <div className="mt-2 text-[0.78rem] opacity-55">{t('После добавления любое блюдо можно открыть и поправить: вес, посуду, КБЖУ.')}</div>
        </div>
      )}
    </SheetPage>
  );
}
