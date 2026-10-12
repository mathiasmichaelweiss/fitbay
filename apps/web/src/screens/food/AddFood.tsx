import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import type { Meal, Recipe, Slot } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { FoodIcon, PlateIcon } from '@/components/ui/food-icons';
import { OptionCard } from '@/components/ui/option-card';
import { SheetPage } from '@/components/ui/sheet-page';
import { SingleToggle } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { resizeImage } from '@/lib/image';
import { api, ApiError } from '@/data/api';
import { useMealOps, useRecipeOps, useRecipes } from '@/data/hooks';
import { normItems, p100, recipeAt, recipeFrom, recipeTimes, scaleAll, scaleIt, sumItems, type It, type Res } from './logic';

/** Порт листа «Добавить еду» прототипа (sh-log): LM, dishCard, plateCard, estimate, res, rEdit, save, openEdit. */
type Lm = 'photo' | 'text' | 'rec' | 'day';
const LM: [Lm, string, string, string, string][] = [
  ['photo', '📸', 'rgba(255,90,10,.18)', 'Сфотографировать', 'Фото тарелки, ИИ посчитает калории'],
  ['text', '✍️', 'rgba(242,183,5,.18)', 'Описать словами', 'Например: гречка с курицей, полная тарелка'],
  ['rec', '⭐', 'rgba(175,217,218,.18)', 'Из моих блюд', 'Сохранённые блюда и рецепты, без ИИ'],
  ['day', '🎙', '#222', 'Весь день разом', 'Рассказать голосом или текстом, что ел за день'],
];
const TYPES = [['flat', 'Плоская'], ['deep', 'Глубокая'], ['bowl', 'Миска'], ['box', 'Контейнер']] as const;
const SIZES: Record<string, [string, string][]> = {
  flat: [['S', '20 см'], ['M', '24 см'], ['L', '28 см']],
  deep: [['S', '18 см'], ['M', '22 см'], ['L', '26 см']],
  bowl: [['S', '300 мл'], ['M', '500 мл'], ['L', '800 мл']],
  box: [['S', '500 мл'], ['M', '750 мл'], ['L', '1 л']],
};
const FILLS: [string, string][] = [['quarter', 'Четверть'], ['half', 'Половина'], ['full', 'Полная'], ['heap', 'С горкой']];
const lmLast = () => {
  try {
    return localStorage.getItem('lmLast');
  } catch {
    return null;
  }
};

type Fields = { k: string; p: string; f: string; c: string };
const toFields = (r: { kcal?: number; protein?: number; fat?: number; carbs?: number }): Fields => ({
  k: r.kcal != null ? String(Math.round(r.kcal)) : '',
  p: r.protein != null ? String(Math.round(r.protein)) : '',
  f: r.fat != null ? String(Math.round(r.fat)) : '',
  c: r.carbs != null ? String(Math.round(r.carbs)) : '',
});

export function AddFood({ date, open, edit, onClose, onQuickDay }: { date: string; open: boolean; edit?: Meal | null; onClose: () => void; onQuickDay: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'de' ? 'de' : 'ru';
  const { create, update } = useMealOps();
  const recipeOps = useRecipeOps();
  const { data: recipes = [] } = useRecipes();
  const recs = [...recipes].sort((a, b) => (b.used || 0) - (a.used || 0));
  const fileRef = useRef<HTMLInputElement>(null);

  const [lm, setLm] = useState<Lm | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [dish, setDish] = useState('');
  const [desc, setDesc] = useState('');
  const [plate, setPlate] = useState({ type: 'none', size: 'M', fill: 'half' });
  const [grams, setGrams] = useState('');
  const [plateOpen, setPlateOpen] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [base, setBase] = useState<{ g: number; kcal: number; protein: number; fat: number; carbs: number } | null>(null);
  const [items, setItems] = useState<It[] | null>(null);
  const [fields, setFields] = useState<Fields>({ k: '', p: '', f: '', c: '' });
  const [rg, setRg] = useState('');
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [asRec, setAsRec] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [addQ, setAddQ] = useState('');
  const [addErr, setAddErr] = useState('');
  // «Из моих блюд»
  const [recSel, setRecSel] = useState<string | null>(null);
  const [port, setPort] = useState(1);
  const [recG, setRecG] = useState<number | null>(null);
  const [fromRec, setFromRec] = useState<string | null>(null);
  const [modOn, setModOn] = useState(false);
  const [modTxt, setModTxt] = useState('');
  const [modInfo, setModInfo] = useState('');

  const reset = () => {
    setLm(null); setImg(null); setThumb(null); setDish(''); setDesc(''); setPlate({ type: 'none', size: 'M', fill: 'half' }); setGrams('');
    setPlateOpen(false); setRes(null); setBase(null); setItems(null); setFields({ k: '', p: '', f: '', c: '' }); setRg(''); setChosenName(null);
    setAsRec(false); setSlot(null); setErr(''); setBusy(null); setAddQ(''); setAddErr(''); setRecSel(null); setPort(1); setRecG(null);
    setFromRec(null); setModOn(false); setModTxt(''); setModInfo('');
  };

  /** fill(r) прототипа */
  const fill = (r: Res) => {
    const it = normItems(r.items);
    setRes(r);
    setItems(it);
    setBase({ g: +(r.grams ?? 0) || 0, kcal: +(r.kcal ?? 0) || 0, protein: +(r.protein ?? 0) || 0, fat: +(r.fat ?? 0) || 0, carbs: +(r.carbs ?? 0) || 0 });
    setChosenName(null);
    if (it) applyItems(it, r);
    else {
      setFields(toFields(r));
      setRg(r.grams ? String(Math.round(r.grams)) : '');
    }
  };
  /** itemsApply прототипа: итог = сумма состава */
  const applyItems = (it: It[], r: Res | null = res) => {
    const s = sumItems(it);
    setFields({ k: String(Math.round(s.kcal)), p: String(Math.round(s.p)), f: String(Math.round(s.f)), c: String(Math.round(s.c)) });
    setRg(s.g ? String(Math.round(s.g)) : '');
    if (r) setRes({ ...r, grams: s.g });
  };

  // Редактирование блюда (openEdit)
  const [editFor, setEditFor] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (edit && editFor !== edit.id) {
      reset();
      setEditFor(edit.id);
      setLm('text');
      setDish(edit.dish || edit.name || '');
      setDesc(edit.desc || '');
      setGrams(edit.grams ? String(edit.grams) : '');
      if (edit.plate) setPlate({ type: edit.plate.type, size: edit.plate.size ?? 'M', fill: edit.plate.fill ?? 'half' });
      if (edit.thumb) setThumb(edit.thumb);
      setFromRec(edit.recId ?? null);
      setSlot(edit.slot ?? null);
      fill({ name: edit.name, grams: edit.grams, items: edit.items ?? null, kcal: edit.kcal, protein: edit.protein, fat: edit.fat, carbs: edit.carbs, confidence: edit.confidence, note: '' });
    }
    if (!edit && editFor) {
      reset();
      setEditFor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  const close = () => {
    reset();
    setEditFor(null);
    onClose();
  };
  const isEdit = !!edit;
  const showPlate = lm === 'photo' || lm === 'text' || (lm === 'rec' && !!recSel);

  const pick = (k: Lm) => {
    try {
      localStorage.setItem('lmLast', k);
    } catch {
      /* ok */
    }
    if (k === 'day') {
      close();
      onQuickDay();
      return;
    }
    setLm(k);
    if (k === 'photo' && !thumb) setTimeout(() => fileRef.current?.click(), 60);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setImg((await resizeImage(f, 1024, 0.8)).split(',')[1] ?? null);
      setThumb(await resizeImage(f, 200, 0.7));
    } catch {
      setErr(t('Не получилось посчитать, попробуй еще раз.'));
    }
  };

  const estimate = async () => {
    setErr('');
    if (!dish.trim() && !img && !desc.trim()) return setErr(t('Напиши название или добавь фото.'));
    setBusy('estimate');
    try {
      const task = img ? 'food_photo' : 'food_text';
      const r = await api.call<{ result: Res; imageSkipped?: boolean }>('POST', `/ai/${task}`, {
        dish: dish.trim(), desc: desc.trim(), plate: plate.type === 'none' ? null : plate, grams: Number(grams) || null, image: img ?? undefined, lang, day: date,
      });
      fill(r.result);
      if (r.imageSkipped) setErr(t('Фото не удалось отправить, посчитал по описанию и весу.'));
    } catch (e) {
      setErr(e instanceof ApiError && (e.status === 429 || e.status === 503 || e.status === 400) ? t(e.message) : t('Не получилось посчитать, попробуй еще раз.'));
    } finally {
      setBusy(null);
    }
  };

  /** rG / ½ ¾ ×1¼ ×1½ (scaleAll прототипа) */
  const setTotal = (ng: number) => {
    if (!(ng > 0)) return;
    if (items) {
      const it = scaleAll(items, ng);
      setItems(it);
      applyItems(it);
      return;
    }
    if (!base?.g) {
      if (res) setRes({ ...res, grams: ng });
      return;
    }
    const k = ng / base.g;
    setFields(toFields({ kcal: base.kcal * k, protein: base.protein * k, fat: base.fat * k, carbs: base.carbs * k }));
    if (res) setRes({ ...res, grams: ng });
  };

  const addIng = async () => {
    const q = addQ.trim();
    if (!q) return;
    setAddErr('');
    setBusy('add');
    try {
      const r = await api.call<{ result: { items: unknown } }>('POST', '/ai/food_items', { text: q, lang });
      const it = normItems(r.result?.items);
      if (!it) throw new Error();
      let cur = items;
      if (!cur) {
        const g = Number(rg) || res?.grams || 0;
        cur = g ? [{ n: res?.name || t('Блюдо'), g, kcal: +fields.k || 0, p: +fields.p || 0, f: +fields.f || 0, c: +fields.c || 0 }] : [];
      }
      const next = [...cur, ...it];
      setItems(next);
      applyItems(next);
      setAddQ('');
    } catch (e) {
      setAddErr(e instanceof ApiError && (e.status === 429 || e.status === 503) ? t(e.message) : t('Не получилось посчитать, попробуй еще раз.'));
    } finally {
      setBusy(null);
    }
  };

  /** applyRec прототипа */
  const applyRec = (r: Recipe, opts: { g?: number | null; m?: number } = {}) => {
    const h = p100(r);
    if (h) {
      const g = opts.g ?? recG ?? r.grams ?? 100;
      setRecG(g);
      setGrams(String(Math.round(g)));
      fill({ ...recipeAt(r, g), confidence: t('сохранено'), note: `${r.desc ? `${r.desc}. ` : ''}${lang === 'de' ? 'Pro 100 g: ' : 'На 100 г: '}${Math.round(h.kcal)} kcal` });
    } else fill({ ...recipeTimes(r, opts.m ?? port), confidence: t('сохранено'), note: r.desc || '' });
    setThumb((x) => x || r.thumb || null);
    setAsRec(false);
    setFromRec(r.id);
  };
  const selRec = recs.find((r) => r.id === recSel) ?? null;

  const recAI = async () => {
    if (!selRec) return;
    setErr('');
    setBusy('recai');
    try {
      const r = await api.call<{ result: { grams?: number } }>('POST', '/ai/food_portion', { recId: selRec.id, said: desc.trim() || dish.trim(), plate: plate.type === 'none' ? null : plate, lang });
      if (r.result?.grams) applyRec(selRec, { g: Math.round(r.result.grams) });
    } catch (e) {
      setErr(e instanceof ApiError && (e.status === 429 || e.status === 503) ? t(e.message) : t('Не получилось посчитать, попробуй еще раз.'));
    } finally {
      setBusy(null);
    }
  };
  const recMod = async () => {
    if (!selRec || !modTxt.trim()) return;
    setErr('');
    setBusy('mod');
    const cur = items?.length
      ? items.map((x) => `${x.n}: ${Math.round(x.g)} г, ${Math.round(x.kcal)} ккал, Б ${Math.round(x.p)}, Ж ${Math.round(x.f)}, У ${Math.round(x.c)}`).join('\n')
      : `состав: ${selRec.desc || 'не указан'}; порция ${base?.g || selRec.grams || '?'} г, ${Math.round(base?.kcal || 0)} ккал`;
    try {
      const r = await api.call<{ result: { items: unknown; note?: string } }>('POST', '/ai/food_mod', { recId: selRec.id, current: cur, change: modTxt.trim(), lang });
      const it = normItems(r.result?.items);
      if (!it) throw new Error();
      const s = sumItems(it);
      fill({ name: selRec.name, grams: s.g, items: it, kcal: s.kcal, protein: s.p, fat: s.f, carbs: s.c, confidence: t('изменено'), note: `${lang === 'de' ? 'Heute anders: ' : 'Сегодня по-другому: '}${modTxt.trim()}` });
      setFromRec(selRec.id);
      setModInfo(`${r.result.note ? `${r.result.note} · ` : ''}${Math.round(s.kcal)} kcal, ${Math.round(s.g)} g`);
    } catch (e) {
      setErr(e instanceof ApiError && (e.status === 429 || e.status === 503) ? t(e.message) : t('Не получилось пересчитать. Попробуй сформулировать иначе.'));
    } finally {
      setBusy(null);
    }
  };

  /** $("save").onclick прототипа */
  const save = async () => {
    setErr('');
    const r = res ?? ({ name: '' } as Res);
    const name = chosenName || r.name || dish || t('Блюдо');
    const g = Number(rg) || Number(grams) || (r.grams ? Math.round(r.grams) : null);
    const ts = Date.now();
    const m: Omit<Meal, 'id'> = {
      date: edit?.date ?? date,
      ts: edit?.ts ?? ts,
      name,
      dish: dish.trim(),
      desc: desc.trim(),
      kcal: +fields.k || 0, protein: +fields.p || 0, fat: +fields.f || 0, carbs: +fields.c || 0,
      grams: g || undefined,
      items: items?.length ? items.map((x) => ({ n: x.n, g: Math.round(x.g), kcal: Math.round(x.kcal), p: Math.round(x.p * 10) / 10, f: Math.round(x.f * 10) / 10, c: Math.round(x.c * 10) / 10 })) : null,
      plate,
      confidence: r.confidence || '',
      thumb: thumb || '',
      recId: fromRec || edit?.recId || null,
      ...(isEdit ? { slot: slot ?? undefined } : {}),
    };
    setBusy('save');
    try {
      // Поправка веса: ИИ оценил, человек взвесил иначе (только для нового блюда не из книги).
      const eg = base?.g;
      if (eg && m.grams && !isEdit && !fromRec && Math.abs(m.grams - eg) / eg > 0.15) {
        api.call('POST', '/me/corrections', { dish: m.dish || m.name, est: Math.round(eg), real: Math.round(m.grams) }).catch(() => undefined);
      }
      if (asRec) {
        const rec = await recipeOps.create.mutateAsync({ ...recipeFrom(m), date } as never);
        m.recId = (rec as Recipe).id;
      } else if (m.recId && !isEdit) {
        const rr = recs.find((x) => x.id === m.recId);
        if (rr) recipeOps.update.mutate({ id: rr.id, used: (rr.used || 0) + 1, ...(m.thumb && m.thumb !== rr.thumb ? { thumb: m.thumb } : {}) });
      }
      if (isEdit) await update.mutateAsync({ ...m, id: edit!.id });
      else await create.mutateAsync(m);
      close();
    } catch {
      setErr(t('Не удалось сохранить.'));
      setBusy(null);
    }
  };

  const title = isEdit ? t('Изменить блюдо') : t(lm ? LM.find((x) => x[0] === lm)![3] : 'Добавить еду');
  const shownName = chosenName || res?.name || '';
  const last = lmLast();

  return (
    <SheetPage
      open={open}
      onOpenChange={(o) => !o && close()}
      title={title}
      onBack={lm && !isEdit ? () => (lm === 'rec' && recSel ? (setRecSel(null), setRes(null), setItems(null), setFromRec(null)) : reset()) : undefined}
      backLabel={t('Назад')}
    >
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />

      {!lm && (
        <div role="radiogroup" aria-label={t('Как добавишь еду?')}>
          <p className="m-0 mb-3.5 text-[0.92rem] text-muted-foreground">{t('Как добавишь еду?')}</p>
          <div className="grid gap-2.5">
            {[...LM].sort((a, b) => Number(b[0] === last) - Number(a[0] === last)).map(([k, ic, bg, title2, sub]) => (
              <OptionCard
                key={k}
                icon={ic}
                iconBg={bg}
                title={
                  <>
                    {t(title2)}
                    {k === last && <span className="ml-1.5 rounded-full bg-primary px-2 py-0.5 align-[2px] text-[0.68rem] font-semibold text-on-color">{t('последний')}</span>}
                  </>
                }
                sub={t(sub)}
                onClick={() => pick(k)}
              />
            ))}
          </div>
        </div>
      )}

      {lm === 'rec' && (
        <div className="mb-2.5 rounded-xl bg-card p-4">
          <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Мои блюда')}</div>
          {!recs.length ? (
            <p className="m-0 opacity-60">{t('Пока пусто. Сохрани блюдо после расчёта галочкой «Сохранить в мои блюда».')}</p>
          ) : (
            <>
              {(selRec ? [selRec] : recs).map((r) => {
                const h = p100(r);
                return (
                  <div key={r.id} className="flex items-center gap-2.5 border-t border-[#2a2a2a] py-2 first:border-t-0">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => {
                        if (recSel === r.id) {
                          setRecSel(null);
                          setRes(null);
                          setFromRec(null);
                          return;
                        }
                        setRecSel(r.id);
                        setPort(1);
                        setRecG(null);
                        setModOn(false);
                        setModTxt('');
                        setModInfo('');
                        applyRec(r, { g: r.grams ?? null, m: 1 });
                      }}
                    >
                      <FoodIcon name={r.name} thumb={r.thumb} />
                      <span className="min-w-0">
                        <div className={cn('truncate font-semibold', recSel === r.id && 'text-brand-orange')}>{r.name}</div>
                        <div className="text-[0.8rem] text-muted-foreground">
                          {h ? `${Math.round(h.kcal)} kcal / 100 g` : `${r.kcal} kcal`} · {lang === 'de' ? 'E' : 'Б'} {h ? Math.round(h.protein) : r.protein}
                        </div>
                      </span>
                    </button>
                    <button type="button" className="px-1.5 py-1 text-xl opacity-50" aria-label={`${t('Удалить')}: ${r.name}`} onClick={() => recipeOps.remove.mutate(r.id)}>
                      ×
                    </button>
                  </div>
                );
              })}
              {selRec && (
                <Button variant="secondary" className="mt-2.5 w-full" onClick={() => (setRecSel(null), setRes(null), setFromRec(null))}>
                  {t('Выбрать другое блюдо')}
                </Button>
              )}
              {selRec && !p100(selRec) && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Порция')}</div>
                  <SingleToggle value={String(port)} onChange={(v) => (setPort(+v), applyRec(selRec, { m: +v }))} options={[['0.5', '½'], ['1', '1'], ['1.5', '1½'], ['2', '2']].map(([v, l]) => ({ value: v!, label: l! }))} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {lm === 'rec' && selRec && (
        <div className="mb-2.5 rounded-2xl bg-[#1c1c1c] px-3.5 py-3">
          <label htmlFor="rc-mod" className="flex cursor-pointer items-center gap-2.5 font-semibold">
            <Checkbox id="rc-mod" checked={modOn} onCheckedChange={(v) => { setModOn(v === true); if (v !== true) { setModInfo(''); applyRec(selRec); } }} />
            {t('Сегодня по-другому')}
          </label>
          {modOn && (
            <>
              <p className="my-2 text-[0.8rem] leading-snug text-muted-foreground">{t('Напиши или надиктуй, что изменилось. Например: без фиников, скира на 20% меньше. Рецепт в книге не изменится.')}</p>
              <textarea value={modTxt} onChange={(e) => setModTxt(e.target.value)} placeholder={t('без фиников, скира на 20% меньше')} className="min-h-[60px] w-full rounded-md border bg-secondary px-[13px] py-[11px] outline-none focus-visible:border-ring" />
              <Button variant="secondary" className="mt-2.5 w-full" disabled={busy === 'mod'} onClick={recMod}>
                {busy === 'mod' ? t('Считаю...') : t('Пересчитать')}
              </Button>
              {modInfo && <div className="mt-2 text-[0.8rem] text-muted-foreground">{modInfo}</div>}
            </>
          )}
        </div>
      )}

      {(lm === 'photo' || lm === 'text') && (
        <div className="mb-2.5 flex flex-col rounded-xl bg-card p-4">
          <div className={cn(lm === 'text' && 'order-9 mt-1.5')}>
            <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Фото')}</div>
            <div className="flex items-center gap-3">
              {thumb && <img src={thumb} alt="" className="size-[68px] rounded-2xl object-cover" />}
              <Button variant="secondary" className={cn('flex-1', lm === 'photo' && !thumb && 'h-auto py-8')} onClick={() => fileRef.current?.click()}>
                {thumb ? t('Заменить') : t('Сделать или выбрать фото')}
              </Button>
            </div>
          </div>
          <Field className="mt-3" label={t('Блюдо')} value={dish} onChange={(e) => setDish(e.target.value)} placeholder={t('Тыквенное ризотто')} autoFocus={lm === 'text' && !isEdit} />
          <label htmlFor="af-desc" className="mb-1.5 mt-3 block text-[0.8rem] text-muted-foreground">
            {t('Подробности')}
          </label>
          <textarea id="af-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('Сливки, пармезан, масло...')} className="min-h-[60px] w-full rounded-md border bg-secondary px-[13px] py-[11px] outline-none focus-visible:border-ring" />
        </div>
      )}

      {showPlate && (
        <div className="mb-2.5 overflow-hidden rounded-xl bg-card p-4">
          <button type="button" aria-expanded={plateOpen} onClick={() => setPlateOpen((o) => !o)} className="flex w-full items-center justify-between font-semibold">
            {t('Уточнить порцию: посуда и вес')}
            <span className="text-2xl text-muted-foreground">{plateOpen ? '−' : '+'}</span>
          </button>
          {plateOpen && (
            <div className="mt-3">
              <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Посуда')}</div>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t('Посуда')}>
                {TYPES.map(([k, n]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={plate.type === k}
                    onClick={() => setPlate((p) => ({ ...p, type: k }))}
                    className={cn('flex flex-col items-center gap-0.5 rounded-2xl bg-secondary px-1 py-2 text-[0.78rem] text-[#ddd]', plate.type === k && 'bg-brand-cream text-on-color')}
                  >
                    <PlateIcon kind={k} />
                    {t(n)}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                className={cn('mt-2.5 w-full', plate.type === 'none' && 'bg-primary text-on-color hover:bg-primary')}
                aria-pressed={plate.type === 'none'}
                onClick={() => setPlate((p) => ({ ...p, type: 'none' }))}
              >
                {t('Не знаю, считай обычную порцию')}
              </Button>
              {plate.type !== 'none' && (
                <>
                  <div className="mb-1.5 mt-3 text-[0.8rem] text-muted-foreground">{t('Размер')}</div>
                  <SingleToggle aria-label={t('Размер')} value={plate.size} onChange={(v) => setPlate((p) => ({ ...p, size: v }))} options={SIZES[plate.type]!.map(([k, n]) => ({ value: k, label: `${k} · ${n}` }))} />
                  <div className="mb-1.5 mt-3 text-[0.8rem] text-muted-foreground">{t('Заполненность')}</div>
                  <SingleToggle aria-label={t('Заполненность')} value={plate.fill} onChange={(v) => setPlate((p) => ({ ...p, fill: v }))} options={FILLS.map(([k, n]) => ({ value: k, label: t(n) }))} />
                </>
              )}
              {lm !== 'rec' && <Field className="mt-3" label={t('Вес, г (если знаешь)')} inputMode="numeric" placeholder={t('Необязательно')} value={grams} onChange={(e) => setGrams(e.target.value)} />}
              {lm === 'rec' && (
                <Button variant="secondary" className="mt-3.5 w-full" disabled={busy === 'recai'} onClick={recAI}>
                  {busy === 'recai' ? t('Считаю...') : t('Пусть ИИ оценит вес по посуде')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {(lm === 'photo' || lm === 'text') && !isEdit && (
        <Button className="w-full" disabled={busy === 'estimate'} onClick={estimate}>
          {busy === 'estimate' ? t('Считаю...') : t(res ? 'Пересчитать' : 'Посчитать')}
        </Button>
      )}
      {err && <p role="alert" className="mt-2 text-[0.88rem] text-brand-orange">{err}</p>}

      {res && (
        <div className="mt-3 rounded-[20px] bg-brand-cream p-3.5 text-on-color" data-testid="result">
          <div className="flex justify-between gap-2">
            <b data-testid="res-name">
              {shownName}
              {res.grams ? `, ~${Math.round(res.grams)} г` : ''}
            </b>
            {res.confidence && <span className="text-[0.8rem] opacity-60">{`${lang === 'de' ? 'Genauigkeit: ' : 'точность: '}${res.confidence}`}</span>}
          </div>
          {!!res.names?.length && (
            <>
              <div className="mt-2.5 text-[0.8rem] opacity-60">{t('Название на выбор')}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {res.names.slice(0, 3).map((n) => (
                  <button key={n} type="button" onClick={() => (setChosenName(n), setDish(n))} className={cn('rounded-full bg-[#111] px-3 py-2 text-[0.85rem] text-white', chosenName === n && 'bg-primary text-on-color')}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
          {res.note && <div className="mt-2 text-[0.85rem] opacity-70">{res.note}</div>}

          {/* renderREdit */}
          <label htmlFor="af-rg" className="mb-1.5 mt-3 block text-[0.8rem] opacity-60">
            {t('Вся порция, г')}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="af-rg"
              inputMode="numeric"
              value={rg}
              placeholder={t('Вес порции')}
              onChange={(e) => {
                setRg(e.target.value);
                setTotal(Number(e.target.value));
              }}
              className="h-[42px] min-w-0 flex-1 rounded-[14px] border border-[#ddd] bg-white px-3 text-[#111]"
            />
            {[['0.5', '½'], ['0.75', '¾'], ['1.25', '×1¼'], ['1.5', '×1½']].map(([f, n]) => (
              <button key={f} type="button" className="whitespace-nowrap rounded-xl bg-black/12 px-2.5 py-2.5 text-[0.82rem]" onClick={() => {
                const cur = Number(rg) || base?.g || 0;
                if (cur) setTotal(Math.round(cur * Number(f)));
              }}>
                {n}
              </button>
            ))}
          </div>
          {items && (
            <>
              <div className="mb-1 mt-3 text-[0.8rem] opacity-60">{t('Состав')}</div>
              {items.map((x, i) => (
                <div key={`${x.n}${i}`} className="flex items-center gap-2 border-t border-black/12 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{x.n}</div>
                    <div className="text-[0.74rem] opacity-60">
                      {Math.round(x.kcal)} {t('ккал')} · {t('Б')} {Math.round(x.p)}
                    </div>
                  </div>
                  <input
                    inputMode="numeric"
                    aria-label={x.n}
                    defaultValue={Math.round(x.g)}
                    onChange={(e) => {
                      const ng = Number(e.target.value);
                      if (!(ng > 0)) return;
                      const next = items.map((y, j) => (j === i ? scaleIt(y, ng) : y));
                      setItems(next);
                      applyItems(next);
                    }}
                    className="h-10 w-[72px] rounded-[14px] border border-[#ddd] bg-white px-2.5 text-right text-[#111]"
                  />
                  <span className="text-[0.8rem] opacity-60">{t('г')}</span>
                  <button type="button" aria-label={`${t('Удалить')}: ${x.n}`} className="grid size-[30px] place-items-center rounded-full bg-black/12" onClick={() => {
                    const next = items.filter((_, j) => j !== i);
                    if (!next.length) setItems(null);
                    else {
                      setItems(next);
                      applyItems(next);
                    }
                  }}>
                    <XIcon className="size-4" />
                  </button>
                </div>
              ))}
            </>
          )}
          <div className="mt-2.5 flex gap-1.5">
            <input
              value={addQ}
              onChange={(e) => setAddQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void addIng())}
              placeholder={t('Добавить: 1 ст. л. масла, 30 г сыра')}
              aria-label={t('Добавить: 1 ст. л. масла, 30 г сыра')}
              className="h-[42px] min-w-0 flex-1 rounded-[14px] border border-[#ddd] bg-white px-3 text-[#111]"
            />
            <button type="button" disabled={busy === 'add'} onClick={() => void addIng()} className="rounded-[14px] bg-[#111] px-3.5 font-semibold text-white disabled:opacity-50">
              {busy === 'add' ? '…' : t('Добавить')}
            </button>
          </div>
          {addErr && <p className="mt-2 text-[0.88rem] text-[#b8330a]">{addErr}</p>}

          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {(
              [
                ['k', 'ккал'],
                ['p', 'белки'],
                ['f', 'жиры'],
                ['c', 'углев.'],
              ] as const
            ).map(([k, l]) => (
              <div key={k}>
                <input
                  inputMode="numeric"
                  aria-label={t(l)}
                  value={fields[k]}
                  onChange={(e) => setFields((x) => ({ ...x, [k]: e.target.value }))}
                  className="h-[42px] w-full rounded-[14px] border border-[#ddd] bg-white px-1 text-center text-[#111]"
                />
                <small className="block text-center text-[0.72rem] opacity-60">{t(l)}</small>
              </div>
            ))}
          </div>

          {isEdit && (
            <>
              <div className="mb-1.5 mt-3 text-[0.8rem] opacity-60">{t('Прием пищи')}</div>
              <SingleToggle
                aria-label={t('Прием пищи')}
                value={slot ?? 'auto'}
                onChange={(v) => setSlot(v === 'auto' ? null : (v as Slot))}
                options={[['auto', 'Авто'], ['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин'], ['snack', 'Перекус']].map(([v, l]) => ({ value: v!, label: t(l!) }))}
              />
            </>
          )}
          <label htmlFor="af-asrec" className="mt-3 flex items-center gap-2 text-[0.9rem]">
            <Checkbox id="af-asrec" checked={asRec} onCheckedChange={(v) => setAsRec(v === true)} className="border-[#111]/40 bg-white" />
            {t('Сохранить в мои блюда')}
          </label>
          <Button className="mt-3.5 w-full bg-[#111] text-white hover:bg-[#111]/90" disabled={busy === 'save'} onClick={save}>
            {t('Сохранить')}
          </Button>
        </div>
      )}
    </SheetPage>
  );
}
