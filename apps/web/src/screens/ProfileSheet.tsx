import { BeforeAfterCard, MeasuresCard } from './Measures';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ACTS, eta, target, type Activity, type CalcProfile, type Goal } from '@fitbay/calc';
import type { Profile } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Field, FieldGroup } from '@/components/ui/field';
import { SheetPage } from '@/components/ui/sheet-page';
import { SingleToggle } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { api } from '@/data/api';
import { today, useSaveProfile, useDayCtx } from '@/data/hooks';

/** «Тело и цели» прототипа (openProf, renderProf, renderMacroBox, eta). Замеры, «До и после» и тренер переносятся в A3.5 и A3.6. */
const GOALS: [Goal, string][] = [['lose', 'Похудение'], ['recomp', 'Рекомпозиция'], ['keep', 'Удержание'], ['gain', 'Набор мышц']];
const WDN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
type M = { p: number | ''; f: number | ''; c: number | '' };

/** macroSum прототипа: ккал из БЖУ и доли. */
export function MacroSum({ p, f, c }: M) {
  const { t } = useTranslation();
  const P = +p || 0, F = +f || 0, C = +c || 0;
  const k = P * 4 + F * 9 + C * 4;
  if (!k) return <span className="text-muted-foreground">{t('Укажи граммы, калории посчитаются сами')}</span>;
  const pc = (x: number) => Math.round((x / k) * 100);
  return (
    <div className="mt-2.5">
      <b>
        {Math.round(k)} {t('ккал')}
      </b>
      <div className="my-1.5 flex h-2 overflow-hidden rounded-[4px] bg-surface-3">
        <i className="block h-full" style={{ width: `${pc(P * 4)}%`, background: 'var(--ok)' }} />
        <i className="block h-full" style={{ width: `${pc(F * 9)}%`, background: 'var(--teal)' }} />
        <i className="block h-full" style={{ width: `${pc(C * 4)}%`, background: 'var(--yellow)' }} />
      </div>
      <span className="text-[0.74rem] text-muted-foreground">
        {t('Б')} {pc(P * 4)}% · {t('Ж')} {pc(F * 9)}% · {t('У')} {pc(C * 4)}%
      </span>
    </div>
  );
}

export function ProfileSheet({ open, profile, onClose, focusMs }: { open: boolean; profile: Profile; onClose: () => void; focusMs?: boolean }) {
  useEffect(() => {
    if (open && focusMs) setTimeout(() => document.getElementById('msCard')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
  }, [open, focusMs]);
  const ctx = useDayCtx();
  const { t, i18n } = useTranslation();
  const de = i18n.language === 'de';
  const save = useSaveProfile();
  const { data: plan } = useQuery({ queryKey: ['plan'], queryFn: () => api.getOne<{ phases?: unknown[] }>('plan').catch(() => null) });
  const lock = !!plan?.phases?.length;
  const [d, setD] = useState<Profile>(profile);
  const [nums, setNums] = useState({ h: String(profile.h), w: String(profile.w), tw: String(profile.tw ?? profile.w), k: String(profile.actGoal?.k ?? 400), m: String(profile.actGoal?.m ?? 30) });
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setD(profile);
      setNums({ h: String(profile.h), w: String(profile.w), tw: String(profile.tw ?? profile.w), k: String(profile.actGoal?.k ?? 400), m: String(profile.actGoal?.m ?? 30) });
    }
  }
  const n = (s: string, fb: number) => Number(s.replace(',', '.')) || fb;
  const draft: Profile = { ...d, h: n(nums.h, d.h), w: n(nums.w, d.w), tw: n(nums.tw, n(nums.w, d.w)) };
  const pct = draft.actPct ?? 0.5;
  const tg = target(draft as unknown as CalcProfile, today(), { ...ctx(today()), pct });
  const auto = target({ ...(draft as unknown as CalcProfile), macro: undefined, flex: undefined }, today(), { ...ctx(today()), pct });
  const m = draft.macro;
  const manual = !!m?.on;
  const fx = !!draft.flex?.on;

  const e = eta(draft as unknown as CalcProfile);
  const etaTxt = !e ? '' : 'wrong' in e ? (de ? ' Zielgewicht passt nicht zur Richtung des Ziels, bitte prüfen.' : ' Целевой вес не совпадает с направлением цели, проверь.') : de ? ` Bis ${draft.tw} kg etwa ${e.weeks} Wochen in ruhigem Tempo.` : ` До ${draft.tw} кг примерно ${e.weeks} нед. в спокойном темпе.`;
  const note = de
    ? `Grundumsatz ${tg.bmr} kcal, mit Aktivität ${tg.tdee} kcal. ${{ lose: 'Abnehmen: minus 15%, ein sanftes Defizit.', recomp: 'Rekomposition: kleines Defizit von 10%, 2,2 g Eiweiß pro kg, um die Muskeln zu halten. Krafttraining ist Pflicht: Street Workout oder Gym, mindestens 3 Mal pro Woche.', keep: 'Halten: Essen auf Höhe des Verbrauchs.', gain: 'Aufbau: plus 10% und mehr Eiweiß.' }[draft.goal]}${etaTxt} Richtwert nach Mifflin-Formel, keine medizinische Empfehlung.`
    : `Базовый обмен ${tg.bmr} ккал, с активностью ${tg.tdee} ккал. ${{ lose: 'Для похудения минус 15%, это мягкий дефицит.', recomp: 'Рекомпозиция: небольшой дефицит 10%, белок 2,2 г на кг, чтобы сохранить мышцы. Обязательны силовые: воркаут, зал, хотя бы 3 раза в неделю.', gain: 'Для набора плюс 10% и больше белка.', keep: 'Для удержания едим на уровне расхода.' }[draft.goal]}${etaTxt} Это ориентир по формуле Миффлина, не медицинская рекомендация.`;

  const setPlan = (k: 'std' | 'flex') => {
    if (k === 'flex') {
      const base = manual ? { p: +(m!.p || auto.p), f: +(m!.f || auto.f), c: +(m!.c || auto.c) } : { p: auto.p, f: auto.f, c: auto.c };
      setD((x) => ({ ...x, flex: { on: true, days: x.flex?.days ?? [1, 3, 5], train: x.flex?.train ?? { p: base.p, f: base.f, c: Math.round(base.c * 1.25) }, rest: x.flex?.rest ?? { p: base.p, f: base.f, c: Math.round(base.c * 0.75) } } }));
    } else if (d.flex) setD((x) => ({ ...x, flex: { ...x.flex!, on: false } }));
  };
  const setMode = (k: 'auto' | 'man') =>
    setD((x) => ({ ...x, macro: { ...(x.macro ?? { p: 0, f: 0, c: 0 }), on: k === 'man', ...(k === 'man' && !x.macro?.p ? { p: auto.p, f: auto.f, c: auto.c } : {}) } }));
  const grid = (val: M, onSet: (k: 'p' | 'f' | 'c', v: number | '') => void, prefix: string) => (
    <div className="mt-2.5 grid grid-cols-3 gap-2">
      {(
        [
          ['p', 'Белок'],
          ['f', 'Жиры'],
          ['c', 'Углеводы'],
        ] as const
      ).map(([k, nn]) => (
        <Field key={k} label={`${t(nn)}, ${t('г')}`} aria-label={prefix ? `${t(nn)}, ${t('г')} (${prefix})` : undefined} inputMode="numeric" value={val[k] === '' ? '' : String(val[k] ?? '')} onChange={(ev) => onSet(k, ev.target.value === '' ? '' : Number(ev.target.value) || 0)} />
      ))}
    </div>
  );

  const submit = () => {
    const out: Profile = { ...draft, actGoal: { k: Math.max(50, Number(nums.k) || 400), m: Math.max(5, Number(nums.m) || 30) } };
    if (out.goal === 'keep') out.tw = out.w;
    save.mutate(out, { onSuccess: onClose });
  };

  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Тело и цели')}>
      <div className="mb-2.5 grid gap-3 rounded-xl bg-card p-4">
        <FieldGroup label={t('Пол')}>
          <SingleToggle value={d.sex} onChange={(v) => setD((x) => ({ ...x, sex: v }))} options={[{ value: 'm', label: t('Мужской') }, { value: 'f', label: t('Женский') }]} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-2">
          <FieldGroup label={t('Дата рождения')}>
            <DatePicker aria-label={t('Дата рождения')} title={t('Дата рождения')} value={d.birth} onChange={(v) => setD((x) => ({ ...x, birth: v }))} lang={i18n.language} placeholder={t('Выберите дату')} doneLabel={t('Готово')} max="2015-12-31" />
          </FieldGroup>
          <Field label={t('Рост, см')} inputMode="numeric" value={nums.h} onChange={(ev) => setNums((x) => ({ ...x, h: ev.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('Вес сейчас, кг')} inputMode="decimal" value={nums.w} onChange={(ev) => setNums((x) => ({ ...x, w: ev.target.value }))} />
          <Field label={t('Цель, кг')} inputMode="decimal" value={nums.tw} onChange={(ev) => setNums((x) => ({ ...x, tw: ev.target.value }))} className={cn(d.goal === 'keep' && 'invisible')} />
        </div>
        <FieldGroup label={t('Тренировок в неделю')}>
          <SingleToggle value={String(d.act)} onChange={(v) => setD((x) => ({ ...x, act: Number(v) as Activity }))} options={ACTS.map((a) => ({ value: String(a.value), label: a.label }))} />
        </FieldGroup>
        <FieldGroup label={t('Цель')}>
          <SingleToggle value={d.goal} onChange={(v) => setD((x) => ({ ...x, goal: v }))} options={GOALS.map(([g, l]) => ({ value: g, label: t(l) }))} />
        </FieldGroup>
      </div>

      <div className="mb-2.5 rounded-xl bg-card p-4">
        <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Твоя норма в день')}</div>
        <div className="grid grid-cols-4 gap-1.5 text-center" data-testid="prof-sum">
          {(
            [
              ['ккал', tg.k],
              ['белок', `${tg.p}${t('г')}`],
              ['жиры', `${tg.f}${t('г')}`],
              ['углев.', `${tg.c}${t('г')}`],
            ] as const
          ).map(([l, v]) => (
            <div key={l}>
              <b className="block text-xl">{v}</b>
              <span className="text-[0.72rem] text-muted-foreground">{t(l)}</span>
            </div>
          ))}
        </div>
        <p className="mb-0 mt-3 text-[0.8rem] text-muted-foreground" data-testid="prof-note">{note}</p>
      </div>

      <div className="mb-2.5 rounded-xl bg-card p-4">
        <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Белки, жиры, углеводы')}</div>
        <SingleToggle aria-label={t('План')} className="mb-2" value={fx ? 'flex' : 'std'} onChange={setPlan} options={[{ value: 'std', label: t('Стандартный') }, { value: 'flex', label: t('Гибкий') }]} />
        {!fx && !lock && <SingleToggle aria-label={t('Режим')} value={manual ? 'man' : 'auto'} onChange={setMode} options={[{ value: 'auto', label: t('Авто') }, { value: 'man', label: t('Вручную') }]} />}
        {lock ? (
          <p className="mb-0 mt-2 text-[0.8rem] text-muted-foreground">{t('Сейчас норму задаёт план тренера. Ручные БЖУ включатся, когда плана не будет.')}</p>
        ) : fx ? (
          <>
            <div className="mt-2.5 text-[0.74rem] text-muted-foreground">{t('Тренировочные дни недели')}</div>
            <div className="mt-1 flex gap-[5px]" role="group" aria-label={t('Тренировочные дни недели')}>
              {WDN.map((wn, i) => {
                const on = draft.flex!.days.includes(i + 1);
                return (
                  <button
                    key={wn}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD((x) => ({ ...x, flex: { ...x.flex!, days: on ? x.flex!.days.filter((y) => y !== i + 1) : [...x.flex!.days, i + 1].sort() } }))}
                    className={cn('h-11 flex-1 rounded-[10px] bg-surface-3 text-[0.78rem] text-[#bbb]', on && 'bg-primary font-bold text-on-color')}
                  >
                    {t(wn)}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 text-[0.72rem] text-muted-foreground">{t('День с тренировкой в журнале или записью к тренеру тоже считается тренировочным')}</div>
            {(
              [
                ['train', '🏋️ Тренировочный день'],
                ['rest', '🛋 День отдыха'],
              ] as const
            ).map(([x, nn]) => (
              <div key={x} className="mt-3">
                <div className="text-[0.8rem] text-muted-foreground">{t(nn)}</div>
                {grid(draft.flex![x], (k, v) => setD((y) => ({ ...y, flex: { ...y.flex!, [x]: { ...y.flex![x], [k]: v } } })), t(nn))}
                <MacroSum {...draft.flex![x]} />
              </div>
            ))}
            <p className="mb-0 mt-2.5 text-[0.76rem] text-muted-foreground">{t('Обычно в дни тренировок больше углеводов, в дни отдыха меньше. Белок одинаковый.')}</p>
          </>
        ) : manual ? (
          <>
            {grid({ p: m!.p, f: m!.f, c: m!.c }, (k, v) => setD((y) => ({ ...y, macro: { ...y.macro!, on: true, [k]: v } })), '')}
            <MacroSum p={m!.p} f={m!.f} c={m!.c} />
            <p className="mb-0 mt-2 text-[0.76rem] text-muted-foreground">
              {t('Авто для твоих данных')}: {t('Б')} {auto.p} · {t('Ж')} {auto.f} · {t('У')} {auto.c} {t('г')}
            </p>
          </>
        ) : (
          <p className="mb-0 mt-2 text-[0.8rem] text-muted-foreground">
            {t('Считаем по весу, цели и активности')}: {t('Б')} {auto.p} · {t('Ж')} {auto.f} · {t('У')} {auto.c} {t('г')}
          </p>
        )}
      </div>

      <div className="mb-2.5 rounded-xl bg-card p-4">
        <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Сожженные калории в рацион')}</div>
        <SingleToggle aria-label={t('Сожженные калории в рацион')} value={String(pct)} onChange={(v) => setD((x) => ({ ...x, actPct: Number(v) }))} options={[['0', '0%'], ['0.5', '50%'], ['1', '100%']].map(([v, l]) => ({ value: v!, label: l! }))} />
        <p className="mb-0 mt-2 text-[0.78rem] leading-snug text-muted-foreground">{t('Сколько от сожженного на тренировках и активностях добавлять к дневной норме. 50% безопаснее: часы обычно завышают расход.')}</p>
      </div>

      <div className="mb-2.5 rounded-xl bg-card p-4">
        <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Цели активности на день')}</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('Сжечь, ккал')} inputMode="numeric" value={nums.k} onChange={(ev) => setNums((x) => ({ ...x, k: ev.target.value }))} />
          <Field label={t('Активных минут')} inputMode="numeric" value={nums.m} onChange={(ev) => setNums((x) => ({ ...x, m: ev.target.value }))} />
        </div>
      </div>

      <Button className="w-full" disabled={save.isPending} onClick={submit}>
        {t('Сохранить')}
      </Button>
      <div className="mt-3.5">
        <BeforeAfterCard />
        <MeasuresCard />
      </div>
    </SheetPage>
  );
}
