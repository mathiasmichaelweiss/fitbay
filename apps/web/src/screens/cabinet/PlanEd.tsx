import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PH_TPL,
  PH_TYPES,
  phNew,
  phTy,
  planRemove,
  planSave,
  type GoalPlan,
  type PhEnd,
  type PhType,
  type PlanPhase,
  type PhWorkout,
} from '@fitbay/calc';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SingleToggle } from '@/components/ui/toggle-group';
import { askConfirm, askReason } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';
import { api } from '@/data/api';
import { useMyTrainer, type Client } from '@/data/cabinet';
import { useClientPlan, usePlanOps, usePlanTpls } from '@/data/plan';
import { MacroSum } from '@/screens/ProfileSheet';
import { useEx } from '@/screens/train/exercises';
import { PhaseArt } from '@/screens/plan/Path';

/** Тренер: редактор плана целей клиента (planEdHtml, bindPlanEd, aiGenPlan, phWoEdHtml, phNutEdHtml прототипа). */
type Draft = { phases: PlanPhase[]; current: number; curChanged?: boolean };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const WDN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** clPlanSum прототипа: подпись плитки «План целей». */
export function usePlanSum(cid: string) {
  const { t } = useTranslation();
  const { data: P } = useClientPlan(cid);
  if (!P?.phases?.length) return t('Плана нет, сейчас стандартная цель');
  const ph = P.phases[P.current || 0];
  return `${t('Фаза')} ${(P.current || 0) + 1}/${P.phases.length}: ${ph?.name || t(phTy(ph?.type).n)}`;
}

const Lb = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-2.5 mb-1 block text-[0.74rem] text-muted-foreground">{children}</span>
);
const numIn = (v: unknown) => (v === '' || v == null ? '' : String(v));
const toNum = (s: string) => (s === '' || s === '-' ? ('' as unknown as number) : +s);

export function PlanSec({ c }: { c: Client }) {
  const { t, i18n } = useTranslation();
  const { data: P, isLoading } = useClientPlan(c.id);
  const { data: tpls = [] } = usePlanTpls();
  const { data: me } = useMyTrainer();
  const ops = usePlanOps(c.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiTxt, setAiTxt] = useState('');
  const [aiPlace, setAiPlace] = useState<'gym' | 'home' | 'street'>('gym');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  if (isLoading) return null;
  const D: Draft =
    draft ?? (P?.phases ? { phases: clone(P.phases), current: P.current || 0 } : { phases: [], current: 0 });
  const upd = (fn: (d: Draft) => void) => {
    const n = clone(D);
    fn(n);
    setSaved(false);
    setDraft(n);
  };
  const setPh = (j: number, fn: (ph: PlanPhase) => void) => upd((d) => d.phases[j] && fn(d.phases[j]));
  const tr = (s: string) => t(s);
  const scrollSave = () =>
    setTimeout(
      () => document.getElementById('plSave2')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      100,
    );

  const applyTpl = async (phases: PlanPhase[]) => {
    if (
      D.phases.length &&
      !(await askConfirm(t('Заменить текущие фазы шаблоном?'), t('Заменить'), t('Отмена')))
    )
      return;
    upd((d) => {
      d.phases = clone(phases);
      d.current = 0;
      d.curChanged = true;
    });
    scrollSave();
  };
  const saveTpl = async () => {
    const nm = await askReason(
      t('Название шаблона'),
      t('Сохранить'),
      t('Отмена'),
      t('Например: Сушка 12 недель, новичок'),
    );
    if (nm === null) return;
    await ops.tplAdd
      .mutateAsync({ kind: 'plan', name: nm || t('Мой шаблон'), phases: clone(D.phases), at: Date.now() })
      .catch(() => {});
  };
  const aiGen = async () => {
    setAiErr('');
    if (!aiTxt.trim()) return setAiErr(t('Опиши этапы плана.'));
    setAiBusy(true);
    try {
      const r = await api.call<{
        result: { phases: (Omit<PlanPhase, 'id' | 'mode' | 'kcal'> & { end: PhEnd })[] };
      }>('POST', '/ai/plan_ai', { cid: c.id, text: aiTxt, place: aiPlace, lang: i18n.language });
      const ph = r.result.phases.map((x) => ({
        ...phNew(x.type as PhType, tr),
        ...x,
        name: x.name || t(phTy(x.type).n),
        mode: 'pct' as const,
        prot: x.prot || phTy(x.type).prot,
      }));
      if (!ph.length) throw new Error();
      setDraft({ phases: ph, current: 0, curChanged: true });
      scrollSave();
    } catch (e) {
      setAiErr(
        (e as Error).message && (e as Error).message.length > 3
          ? (e as Error).message
          : t('Не получилось составить план, попробуй ещё раз.'),
      );
    } finally {
      setAiBusy(false);
    }
  };
  const save = async () => {
    setErr('');
    const data = planSave(P?.phases ? P : null, D, me?.name || t('Тренер'), c.profile?.w ?? null, Date.now());
    try {
      await ops.save.mutateAsync(data);
      setDraft(null);
      setSaved(true);
    } catch {
      setErr(t('Не удалось сохранить.'));
    }
  };
  const del = async () => {
    if (
      !(await askConfirm(
        t('Удалить план? У клиента вернётся его стандартная цель, а этот план останется у него в архиве.'),
      ))
    )
      return;
    await ops.remove.mutateAsync(planRemove(P ?? null, Date.now())).catch(() => {});
    setDraft(null);
  };

  return (
    <div data-testid="plan-ed">
      <Card className="gap-0">
        <div className="text-[0.84rem] leading-snug text-muted-foreground">
          {t(
            'Собери план из фаз. Клиент увидит свой маршрут с картинками, а норма калорий и белка будет считаться по текущей фазе. Фазы переключаются сами по сроку, дате или целевому весу.',
          )}
        </div>
        <Lb>{t('Мои шаблоны')}</Lb>
        {tpls.length ? (
          <div className="flex flex-col gap-1.5">
            {tpls.map((x) => (
              <div key={x.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-full border border-brand-orange bg-[#2a1a10] px-3.5 text-left text-[0.86rem]"
                  onClick={() => void applyTpl(x.phases)}
                >
                  📋 {x.name}{' '}
                  <span className="text-[0.74rem] text-muted-foreground">
                    · {x.phases.length} {t('фаз')}
                    {x.phases.some((p) => (p.workouts || []).length) ? ' · 🏋️' : ''}
                    {x.phases.some((p) => (p.nutrition?.rules ?? []).length) ? ' · 🥗' : ''}
                  </span>
                </button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t('Удалить')}
                  onClick={async () => (await askConfirm(t('Удалить шаблон?'))) && ops.tplDel.mutate(x.id)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[0.8rem] text-muted-foreground">
            {t('Собери план для одного клиента и сохрани его как шаблон, потом назначай другим в один клик.')}
          </div>
        )}
        {D.phases.length > 0 && (
          <Button variant="secondary" className="mt-2 w-full" onClick={() => void saveTpl()}>
            💾 {t('Сохранить этот план как шаблон')}
          </Button>
        )}
        <Lb>{t('Базовые шаблоны')}</Lb>
        <div className="flex flex-wrap gap-1.5">
          {PH_TPL.map(([n, types]) => (
            <button
              key={n}
              type="button"
              className="min-h-9 rounded-full bg-[#262626] px-3.5 text-[0.86rem]"
              onClick={() => upd((d) => ((d.phases = types.map((x) => phNew(x, tr))), (d.current = 0)))}
            >
              {t(n)}
            </button>
          ))}
        </div>
      </Card>

      <Card className="gap-0" style={{ background: 'linear-gradient(160deg,#12302f,#161616)' }}>
        <span className="text-sm text-brand-teal">» {t('Сгенерировать план с ИИ')}</span>
        <div className="text-[0.8rem] leading-snug text-muted-foreground">
          {t(
            'Опиши этапы своими словами. ИИ учтёт вес, рост, возраст, замеры и питание клиента и соберёт фазы с калориями, белком, тренировками и питанием. Потом всё можно поправить.',
          )}
        </div>
        <Textarea
          className="mt-2"
          rows={3}
          value={aiTxt}
          aria-label={t('Сгенерировать план с ИИ')}
          placeholder={t(
            'Например: 1) сушка 8 недель до 80 кг, 2) набор 12 недель, 3) удержание. 3 тренировки в неделю.',
          )}
          onChange={(e) => setAiTxt(e.target.value)}
        />
        <Lb>{t('Где тренируется')}</Lb>
        <SingleToggle<'gym' | 'home' | 'street'>
          value={aiPlace}
          onChange={setAiPlace}
          options={[
            { value: 'gym', label: t('Зал') },
            { value: 'home', label: t('Дома') },
            { value: 'street', label: t('Улица') },
          ]}
        />
        <Button
          className="mt-2.5 w-full bg-brand-teal text-[#111]"
          disabled={aiBusy}
          onClick={() => void aiGen()}
        >
          {aiBusy ? t('ИИ составляет план...') : t('Сгенерировать')}
        </Button>
        {aiErr && <p className="mt-2 text-sm text-brand-orange">{aiErr}</p>}
      </Card>

      {D.phases.map((ph, j) => (
        <PhaseEd
          key={ph.id || j}
          ph={ph}
          j={j}
          cur={j === (D.current || 0)}
          set={(fn) => setPh(j, fn)}
          del={() =>
            upd(
              (d) => (
                d.phases.splice(j, 1),
                d.current >= d.phases.length && (d.current = Math.max(0, d.phases.length - 1))
              ),
            )
          }
          makeCur={() => upd((d) => ((d.current = j), (d.curChanged = true)))}
        />
      ))}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(PH_TYPES) as PhType[]).map((k) => (
          <button
            key={k}
            type="button"
            className="min-h-9 rounded-full bg-[#262626] px-3.5 text-[0.86rem]"
            onClick={() => upd((d) => d.phases.push(phNew(k, tr)))}
          >
            + {t(PH_TYPES[k].n)}
          </button>
        ))}
      </div>
      <Button
        id="plSave2"
        className="mt-3.5 w-full"
        disabled={!D.phases.length || ops.save.isPending}
        onClick={() => void save()}
      >
        {saved && !draft ? t('Сохранено ✓') : t('Сохранить план')}
      </Button>
      {P?.phases && (
        <Button variant="secondary" className="mt-2 w-full text-brand-orange" onClick={() => void del()}>
          {t('Удалить план (вернуть стандартную цель)')}
        </Button>
      )}
      {err && <p className="mt-2 text-sm text-brand-orange">{err}</p>}
    </div>
  );
}

function PhaseEd({
  ph,
  j,
  cur,
  set,
  del,
  makeCur,
}: {
  ph: PlanPhase;
  j: number;
  cur: boolean;
  set: (fn: (ph: PlanPhase) => void) => void;
  del: () => void;
  makeCur: () => void;
}) {
  const { t, i18n } = useTranslation();
  const end = ph.end || { kind: 'none', val: '' };
  const n = (k: keyof PlanPhase, label: string) => (
    <div className="min-w-0">
      <span className="mb-1 block text-[0.7rem] text-muted-foreground">
        {label}, {t('г')}
      </span>
      <Input
        inputMode="numeric"
        aria-label={label}
        value={numIn(ph[k])}
        onChange={(e) =>
          set(
            (p) =>
              ((p as unknown as Record<string, unknown>)[k] = toNum(e.target.value.replace(/[^\d]/g, ''))),
          )
        }
      />
    </div>
  );
  return (
    <div
      className={cn(
        'mt-2.5 rounded-[18px] bg-[#1f1f1f] p-3',
        cur && 'shadow-[inset_0_0_0_2px_var(--orange)]',
      )}
      data-testid="ph-ed"
    >
      <div className="flex items-center gap-2.5">
        <span className="size-10 flex-none">
          <PhaseArt type={ph.type} />
        </span>
        <Input
          className="flex-1"
          aria-label={t('Название')}
          value={ph.name}
          onChange={(e) => set((p) => (p.name = e.target.value))}
        />
        <Button variant="secondary" size="icon" aria-label={t('Удалить')} onClick={del}>
          ×
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(Object.keys(PH_TYPES) as PhType[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={ph.type === k}
            className={cn(
              'min-h-9 rounded-full bg-[#262626] px-3 text-[0.84rem]',
              ph.type === k && 'bg-brand-orange font-semibold text-[#111]',
            )}
            onClick={() =>
              set((p) => {
                const tt = PH_TYPES[k];
                if (p.name === t(phTy(p.type).n)) p.name = t(tt.n);
                p.type = k;
                if ((p.mode || 'pct') === 'pct') p.pct = tt.pct;
                p.prot = tt.prot;
              })
            }
          >
            {t(PH_TYPES[k].n)}
          </button>
        ))}
      </div>
      <Lb>{t('Калории')}</Lb>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['pct', '% к расходу'],
            ['abs', 'ккал'],
            ['macro', 'БЖУ, г'],
            ['flex', 'Трен./отдых'],
          ] as const
        ).map(([k, nm]) => (
          <button
            key={k}
            type="button"
            aria-pressed={(ph.mode || 'pct') === k}
            className={cn(
              'min-h-9 rounded-full bg-[#262626] px-3 text-[0.84rem]',
              (ph.mode || 'pct') === k && 'bg-brand-orange font-semibold text-[#111]',
            )}
            onClick={() => set((p) => (p.mode = k))}
          >
            {t(nm)}
          </button>
        ))}
      </div>
      {(ph.mode || 'pct') === 'pct' || ph.mode === 'abs' ? (
        <Input
          className="mt-1.5"
          inputMode="numeric"
          aria-label={t(ph.mode === 'abs' ? 'ккал' : '% к расходу')}
          value={numIn(ph.mode === 'abs' ? ph.kcal : ph.pct)}
          onChange={(e) => {
            const v = toNum(e.target.value.replace(/[^\d-]/g, ''));
            set((p) => (p.mode === 'abs' ? (p.kcal = v) : (p.pct = v)));
          }}
        />
      ) : null}
      {ph.mode === 'macro' && (
        <>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {n('mp', t('Белок'))}
            {n('mf', t('Жиры'))}
            {n('mc', t('Углеводы'))}
          </div>
          <MacroSum p={ph.mp ?? ''} f={ph.mf ?? ''} c={ph.mc ?? ''} />
        </>
      )}
      {ph.mode === 'flex' && (
        <>
          <Lb>{t('Тренировочные дни недели')}</Lb>
          <div className="flex gap-[5px]">
            {WDN.map((nm, i) => {
              const on = (ph.days || [1, 3, 5]).includes(i + 1);
              return (
                <button
                  key={nm}
                  type="button"
                  aria-pressed={on}
                  className={cn(
                    'min-h-9 flex-1 rounded-[10px] bg-[#262626] text-[0.78rem] text-[#bbb]',
                    on && 'bg-brand-orange font-bold text-[#111]',
                  )}
                  onClick={() =>
                    set(
                      (p) =>
                        (p.days = on
                          ? (p.days || [1, 3, 5]).filter((x) => x !== i + 1)
                          : [...(p.days || [1, 3, 5]), i + 1].sort()),
                    )
                  }
                >
                  {t(nm)}
                </button>
              );
            })}
          </div>
          {(
            [
              ['t', '🏋️ Тренировочный день'],
              ['r', '🛋 День отдыха'],
            ] as const
          ).map(([x, nm]) => (
            <div key={x}>
              <Lb>{t(nm)}</Lb>
              <div className="grid grid-cols-3 gap-2">
                {n(`${x}p` as keyof PlanPhase, t('Белок'))}
                {n(`${x}f` as keyof PlanPhase, t('Жиры'))}
                {n(`${x}c` as keyof PlanPhase, t('Углеводы'))}
              </div>
              <MacroSum
                p={(ph[`${x}p` as keyof PlanPhase] as number) ?? ''}
                f={(ph[`${x}f` as keyof PlanPhase] as number) ?? ''}
                c={(ph[`${x}c` as keyof PlanPhase] as number) ?? ''}
              />
            </div>
          ))}
        </>
      )}
      <Lb>{t('Переход дальше')}</Lb>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['weeks', 'Через N недель'],
            ['weight', 'При весе'],
            ['date', 'В дату'],
            ['none', 'Без срока'],
          ] as const
        ).map(([k, nm]) => (
          <button
            key={k}
            type="button"
            aria-pressed={end.kind === k}
            className={cn(
              'min-h-9 rounded-full bg-[#262626] px-3 text-[0.84rem]',
              end.kind === k && 'bg-brand-orange font-semibold text-[#111]',
            )}
            onClick={() => set((p) => (p.end = { kind: k, val: '' }))}
          >
            {t(nm)}
          </button>
        ))}
      </div>
      {end.kind === 'date' ? (
        <div className="mt-1.5">
          <DatePicker
            value={String(end.val || '')}
            onChange={(v) => set((p) => (p.end = { kind: 'date', val: v }))}
            lang={i18n.language}
            title={t('В дату')}
            doneLabel={t('Готово')}
            aria-label={t('В дату')}
          />
        </div>
      ) : end.kind !== 'none' ? (
        <Input
          className="mt-1.5"
          inputMode="decimal"
          aria-label={t(end.kind === 'weeks' ? 'Через N недель' : 'При весе')}
          placeholder={end.kind === 'weeks' ? '8' : '80'}
          value={numIn(end.val)}
          onChange={(e) =>
            set(
              (p) =>
                (p.end = { kind: end.kind, val: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') }),
            )
          }
        />
      ) : null}
      <Lb>{t('Заметка для клиента')}</Lb>
      <Textarea
        rows={2}
        aria-label={t('Заметка для клиента')}
        value={ph.note || ''}
        onChange={(e) => set((p) => (p.note = e.target.value))}
      />
      <PhWoEd ph={ph} set={set} />
      <PhNutEd ph={ph} set={set} />
      {!cur ? (
        <Button variant="secondary" className="mt-2 w-full" onClick={makeCur}>
          {t('Сделать текущей')}
        </Button>
      ) : (
        <div className="mt-2 text-[0.76rem] font-semibold text-brand-orange">● {t('Текущая фаза')}</div>
      )}
      <span className="sr-only">{j}</span>
    </div>
  );
}

/** phWoEdHtml + phEdInput прототипа: тренировки фазы с прогрессией. Упражнение ищется по названию (вместо datalist). */
function PhWoEd({ ph, set }: { ph: PlanPhase; set: (fn: (ph: PlanPhase) => void) => void }) {
  const { t } = useTranslation();
  const { db, name } = useEx();
  const [q, setQ] = useState<Record<number, string>>({});
  const W = ph.workouts || [];
  const setW = (k: number, fn: (w: PhWorkout) => void) => set((p) => p.workouts?.[k] && fn(p.workouts[k]));
  const cand = (s: string) => {
    const v = s.trim().toLowerCase();
    if (v.length < 2 || !db) return [];
    return db.EX.filter(
      (e) =>
        ['strength', 'powerlifting', 'plyometrics'].includes(e.c) &&
        `${name(e)} ${e.n}`.toLowerCase().includes(v),
    ).slice(0, 6);
  };
  return (
    <details className="mt-2.5" open={W.length > 0}>
      <summary className="min-h-9 cursor-pointer text-[0.88rem] font-semibold">
        🏋️ {t('Тренировки фазы')} · {W.length}
      </summary>
      {W.map((w, k) => (
        <div key={k} className="mt-2 rounded-[14px] bg-[#262626] p-2.5">
          <div className="flex gap-1.5">
            <Input
              className="flex-1"
              aria-label={t('Название')}
              value={w.name}
              onChange={(e) => setW(k, (x) => (x.name = e.target.value))}
            />
            <Button
              variant="secondary"
              size="icon"
              aria-label={t('Удалить')}
              onClick={() => set((p) => p.workouts.splice(k, 1))}
            >
              ×
            </Button>
          </div>
          {w.items.map((it, m) => (
            <div key={m}>
              <div className="mt-1.5 flex items-center gap-1.5 text-[0.84rem]">
                <span className="min-w-0 flex-1 truncate">{db?.EXM[it.id] ? name(it.id) : it.id}</span>
                <Input
                  className="w-12 px-1 text-center"
                  inputMode="numeric"
                  aria-label={t('Подходы')}
                  value={String(it.sets)}
                  onChange={(e) =>
                    setW(k, (x) => x.items[m] && (x.items[m].sets = +e.target.value.replace(/\D/g, '') || 3))
                  }
                />
                <span>×</span>
                <Input
                  className="w-[62px] px-1 text-center"
                  aria-label={t('Повторы')}
                  value={it.reps}
                  onChange={(e) => setW(k, (x) => x.items[m] && (x.items[m].reps = e.target.value))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('Удалить')}
                  onClick={() => setW(k, (x) => x.items.splice(m, 1))}
                >
                  ×
                </Button>
              </div>
              <div className="mt-1 mb-0.5 flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
                <span>{t('кг')}</span>
                <Input
                  className="h-9 w-[58px] px-1 text-center"
                  inputMode="decimal"
                  placeholder="–"
                  aria-label={t('кг')}
                  value={numIn(it.kg)}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                    setW(k, (x) => x.items[m] && (x.items[m].kg = v === '' ? null : +v));
                  }}
                />
                <Select
                  value={it.pg || 'none'}
                  onValueChange={(v) =>
                    setW(k, (x) => {
                      const i = x.items[m];
                      if (!i) return;
                      i.pg = v === 'none' ? '' : (v as 'kg' | 'rep');
                      if (i.pg && i.st == null) i.st = i.pg === 'kg' ? 2.5 : 1;
                    })
                  }
                >
                  <SelectTrigger className="h-9 flex-1 text-[0.78rem]" aria-label={t('без прогрессии')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('без прогрессии')}</SelectItem>
                    <SelectItem value="kg">{t('+ кг в неделю')}</SelectItem>
                    <SelectItem value="rep">{t('+ повторы в неделю')}</SelectItem>
                  </SelectContent>
                </Select>
                {it.pg && (
                  <Input
                    className="h-9 w-[52px] px-1 text-center"
                    inputMode="decimal"
                    aria-label={t('шаг')}
                    value={numIn(it.st ?? (it.pg === 'kg' ? 2.5 : 1))}
                    onChange={(e) => {
                      const v = +e.target.value.replace(',', '.').replace(/[^\d.]/g, '') || 0;
                      setW(k, (x) => x.items[m] && (x.items[m].st = v));
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          <Input
            className="mt-1.5"
            value={q[k] ?? ''}
            placeholder={t('+ упражнение (начни писать)')}
            onChange={(e) => setQ({ ...q, [k]: e.target.value })}
          />
          {cand(q[k] ?? '').map((e) => (
            <button
              key={e.i}
              type="button"
              className="block min-h-11 w-full border-t border-[#333] px-1 py-2 text-left text-[0.86rem]"
              onClick={() => {
                setW(k, (x) => x.items.push({ id: e.i, sets: 3, reps: '10' }));
                setQ({ ...q, [k]: '' });
              }}
            >
              + {name(e)}
            </button>
          ))}
        </div>
      ))}
      <Button
        variant="secondary"
        className="mt-2 w-full"
        onClick={() =>
          set(
            (p) =>
              (p.workouts = [
                ...(p.workouts || []),
                { name: `${t('День')} ${String.fromCharCode(65 + (p.workouts || []).length)}`, items: [] },
              ]),
          )
        }
      >
        {t('+ тренировка')}
      </Button>
    </details>
  );
}

/** phNutEdHtml прототипа: правила и пример меню, по одному в строке. */
function PhNutEd({ ph, set }: { ph: PlanPhase; set: (fn: (ph: PlanPhase) => void) => void }) {
  const { t } = useTranslation();
  const N = ph.nutrition || { rules: [], menu: [] };
  const [raw, setRaw] = useState({ r: N.rules.join('\n'), m: N.menu.join('\n') });
  const lines = (s: string) =>
    s
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  return (
    <details className="mt-2" open={N.rules.length > 0}>
      <summary className="min-h-9 cursor-pointer text-[0.88rem] font-semibold">🍽 {t('Питание фазы')}</summary>
      <Lb>{t('Правила (по одному в строке)')}</Lb>
      <Textarea
        rows={3}
        aria-label={t('Правила (по одному в строке)')}
        value={raw.r}
        onChange={(e) => (
          setRaw({ ...raw, r: e.target.value }),
          set((p) => (p.nutrition = { ...(p.nutrition || { menu: [] }), rules: lines(e.target.value) }))
        )}
      />
      <Lb>{t('Пример меню (по одному в строке)')}</Lb>
      <Textarea
        rows={4}
        aria-label={t('Пример меню (по одному в строке)')}
        value={raw.m}
        onChange={(e) => (
          setRaw({ ...raw, m: e.target.value }),
          set((p) => (p.nutrition = { ...(p.nutrition || { rules: [] }), menu: lines(e.target.value) }))
        )}
      />
    </details>
  );
}

export type { GoalPlan };
