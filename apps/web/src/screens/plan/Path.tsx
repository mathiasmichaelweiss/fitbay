import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  curPhase,
  target,
  phaseTarget,
  phProgress,
  phTy,
  phWeek,
  progT,
  type CalcProfile,
  type GoalPlan,
  type PlanPhase,
  type PhWorkout,
} from '@fitbay/calc';
import type { Program } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { today, useDayCtx, useProfile, useProgramOps } from '@/data/hooks';
import { usePlan } from '@/data/plan';
import { useNav } from '@/nav/store';
import { useEx } from '@/screens/train/exercises';
import { startWorkout } from '@/screens/train/store';
import { cn } from '@/lib/utils';

/** phaseArt прототипа: картинка типа фазы. */
export function PhaseArt({ type, className }: { type?: string; className?: string }) {
  const c = phTy(type).c1;
  const A: Record<string, React.ReactNode> = {
    cut: (
      <>
        <circle cx="60" cy="60" r="54" fill={c} opacity=".12" />
        <path
          d="M60 22c10 14 22 22 22 40a22 22 0 0 1-44 0c0-9 4-15 9-20 1 8 5 12 9 13-3-11 0-23 4-33z"
          fill={c}
        />
        <path d="M60 58c5 6 9 9 9 16a9 9 0 0 1-18 0c0-5 4-8 9-16z" fill="#111" opacity=".5" />
      </>
    ),
    bulk: (
      <>
        <circle cx="60" cy="60" r="54" fill={c} opacity=".12" />
        <path d="M14 92l30-40 16 18 18-30 28 52z" fill={c} opacity=".85" />
        <path d="M78 40l6 8-12 0z" fill="#fff" opacity=".8" />
      </>
    ),
    maint: (
      <>
        <circle cx="60" cy="60" r="54" fill={c} opacity=".12" />
        <path d="M60 26v62" stroke={c} strokeWidth="5" strokeLinecap="round" />
        <path d="M28 40h64" stroke={c} strokeWidth="5" strokeLinecap="round" />
        <path d="M28 40l-12 26h24zM92 40l-12 26h24z" fill={c} opacity=".85" />
        <rect x="44" y="86" width="32" height="7" rx="3" fill={c} />
      </>
    ),
    recomp: (
      <>
        <circle cx="60" cy="60" r="54" fill={c} opacity=".12" />
        <path d="M40 28v52" stroke="#FF5A0A" strokeWidth="7" strokeLinecap="round" />
        <path
          d="M28 68l12 14 12-14"
          stroke="#FF5A0A"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M80 92V40" stroke={c} strokeWidth="7" strokeLinecap="round" />
        <path
          d="M68 52l12-14 12 14"
          stroke={c}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    custom: (
      <>
        <circle cx="60" cy="60" r="54" fill={c} opacity=".12" />
        <circle cx="60" cy="60" r="34" fill="none" stroke={c} strokeWidth="6" />
        <circle cx="60" cy="60" r="18" fill="none" stroke={c} strokeWidth="6" />
        <circle cx="60" cy="60" r="6" fill={c} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" className={className} aria-hidden>
      {A[type ?? ''] ?? A.custom}
    </svg>
  );
}

const num = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

/** Подписи к фазе (phKcalTxt, phEndTxt, текст phProgress). */
export function usePhText() {
  const { t, i18n } = useTranslation();
  const L = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const fD = (ts: number) =>
    new Date(ts).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' });
  return {
    fD,
    kcal: (ph: PlanPhase) =>
      ph.mode === 'flex'
        ? t('гибкий: тренировка / отдых')
        : ph.mode === 'macro'
          ? `${t('Б')} ${ph.mp || 0} · ${t('Ж')} ${ph.mf || 0} · ${t('У')} ${ph.mc || 0} ${t('г')}`
          : ph.mode === 'abs' && +(ph.kcal ?? 0) > 0
            ? `${ph.kcal} ${t('ккал')}`
            : +(ph.pct ?? 0)
              ? `${(ph.pct ?? 0) > 0 ? '+' : '−'}${Math.abs(ph.pct ?? 0)}% ${t('к расходу')}`
              : t('по расходу'),
    end: (ph: PlanPhase) => {
      const e = ph.end || { kind: 'none', val: '' };
      return e.kind === 'weeks' && e.val
        ? `${e.val} ${t('нед.')}`
        : e.kind === 'weight' && e.val
          ? `${t('до')} ${e.val} ${t('кг')}`
          : e.kind === 'date' && e.val
            ? `${t('до')} ${fD(new Date(`${e.val}T12:00`).getTime())}`
            : t('без срока');
    },
    progress: (pr: ReturnType<typeof phProgress>) =>
      !pr
        ? ''
        : pr.kind === 'weeks'
          ? `${t('неделя')} ${pr.a} ${t('из')} ${pr.b}`
          : pr.kind === 'weight'
            ? `${num(pr.a ?? 0)} → ${num(+(pr.b ?? 0))} ${t('кг')}`
            : pr.kind === 'date'
              ? `${t('до')} ${fD(new Date(`${pr.b}T12:00`).getTime())}`
              : t('без срока'),
  };
}

/** planTile прототипа: текущая фаза, прогресс. */
export function PlanTile() {
  const { t } = useTranslation();
  const { data: P } = usePlan();
  const { data: profile } = useProfile();
  const setPath = useNav((s) => s.open);
  const tx = usePhText();
  const ph = curPhase(P);
  if (!P || !ph || !profile) return null;
  const ty = phTy(ph.type),
    pr = phProgress(P, profile.w, Date.now());
  return (
    <button
      type="button"
      data-testid="plan-tile"
      onClick={() => setPath({ path: true })}
      className="col-span-full flex min-h-[120px] items-center gap-3.5 rounded-xl bg-card px-[18px] py-4 text-left"
    >
      <span className="size-[86px] flex-none">
        <PhaseArt type={ph.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[0.68rem] font-semibold tracking-[0.06em] text-muted-foreground">
          {t('ТВОЙ ПЛАН ОТ ТРЕНЕРА')}
        </span>
        <b className="mt-1.5 block text-[1.15rem]">{ph.name || t(ty.n)}</b>
        <span className="text-[0.8rem] text-muted-foreground">
          {t('Фаза')} {(P.current || 0) + 1} {t('из')} {P.phases?.length} · {tx.progress(pr)}
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-[3px] bg-[#2a2a2a]">
          <span
            className="block h-full rounded-[3px]"
            style={{ width: `${Math.round((pr?.p ?? 0) * 100)}%`, background: ty.c1 }}
          />
        </span>
      </span>
    </button>
  );
}

/** progListHtml прототипа: упражнения тренировки фазы с прогрессией на неделю. */
export function ProgList({ w, wk }: { w: PhWorkout; wk: number }) {
  const { t } = useTranslation();
  const { db, name } = useEx();
  return (
    <>
      {w.items.map((x, i) => {
        const tt = progT(x, wk),
          nx = x.pg ? progT(x, wk + 1) : null;
        return (
          <div key={i} className={cn('flex items-center gap-2.5 py-2', i > 0 && 'border-t border-[#2a2a2a]')}>
            <span className="grid size-[22px] flex-none place-items-center rounded-full bg-[#262626] text-[0.72rem]">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              {db?.EXM[x.id] ? name(x.id) : x.id}
              {nx && (
                <div className="text-[0.72rem] text-[#7BC67B]">
                  ↑ {t('след. неделя')}:{' '}
                  {x.pg === 'kg'
                    ? `${String(nx.kg).replace('.', ',')} ${t('кг')}`
                    : `${nx.reps} ${t('повт.')}`}
                </div>
              )}
            </span>
            <span className="text-right whitespace-nowrap">
              <b className="text-[0.9rem]">
                {x.sets || 3}×{tt.reps}
              </b>
              {tt.kg != null && (
                <div className="text-[0.8rem] text-brand-orange">
                  {String(tt.kg).replace('.', ',')} {t('кг')}
                </div>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** phClientExtras прототипа: тренировки и питание текущей фазы. */
function PhExtras({ P, ph }: { P: GoalPlan; ph: PlanPhase }) {
  const { t } = useTranslation();
  const { db } = useEx();
  const open = useNav((s) => s.open);
  const setMode = useNav((s) => s.setMode);
  const W = ph.workouts || [],
    N = ph.nutrition || { rules: [], menu: [] };
  const wk = phWeek(P, Date.now());
  const go = (w: PhWorkout) => {
    const its = w.items.map((x) => {
      const tt = progT(x, wk);
      return { ...x, reps: tt.reps, w: tt.kg };
    });
    const prog = {
      id: null,
      name: w.name + (w.items.some((x) => x.pg) ? ` · ${t('неделя')} ${wk}` : ''),
      items: its,
      plan: {
        week: wk,
        name: w.name,
        items: its.map((x) => ({
          id: x.id,
          sets: +x.sets || 3,
          reps: String(x.reps || ''),
          ...(x.w != null ? { kg: +x.w } : {}),
        })),
      },
    } as unknown as Program;
    open({ path: false });
    setMode('train');
    startWorkout(prog, w.name, '', (id) => !!db?.EXM[id]);
  };
  if (!W.length && !N.rules?.length && !N.menu?.length) return null;
  return (
    <>
      {W.length > 0 && (
        <Card className="gap-0">
          <span className="flex items-center justify-between text-sm text-muted-foreground">
            🏋️ {t('Тренировки этой фазы')}
            {P.phaseStart && (
              <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[0.72rem] font-bold text-[#111]">
                {t('Неделя')} {wk}
              </span>
            )}
          </span>
          {W.map((w, k) => (
            <details key={k} className="border-t border-[#2a2a2a] py-2.5 first-of-type:mt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                <b>{w.name}</b>
                <span className="text-[0.78rem] text-muted-foreground">
                  {w.items.length} {t('упр.')}
                </span>
              </summary>
              <ProgList w={w} wk={wk} />
              <Button variant="secondary" className="mt-2 w-full" onClick={() => go(w)}>
                {t('Начать эту тренировку')}
              </Button>
            </details>
          ))}
        </Card>
      )}
      {(N.rules?.length > 0 || N.menu?.length > 0) && (
        <Card className="gap-0">
          <span className="mb-1 text-sm text-muted-foreground">🍽 {t('Питание этой фазы')}</span>
          {N.rules.map((r, i) => (
            <div key={i} className="flex gap-2 py-1 text-[0.9rem] leading-snug">
              <span className="text-brand-orange">•</span>
              <span>{r}</span>
            </div>
          ))}
          {N.menu.length > 0 && (
            <>
              <div className="mt-2.5 text-[0.76rem] text-muted-foreground">{t('Пример дня')}</div>
              {N.menu.map((m, i) => (
                <div key={i} className="border-t border-[#2a2a2a] py-1.5 text-[0.88rem]">
                  {m}
                </div>
              ))}
            </>
          )}
        </Card>
      )}
    </>
  );
}

/** Прошлые планы (renderPath + data-archwo): тренировки можно забрать в «Мои программы». */
function Archive({ P }: { P: GoalPlan }) {
  const { t } = useTranslation();
  const { db, name } = useEx();
  const tx = usePhText();
  const ops = useProgramOps();
  const [got, setGot] = useState<Record<number, boolean>>({});
  const A = P.archive || [];
  if (!A.length) return null;
  const take = async (j: number) => {
    const a = A[j];
    if (!a) return;
    const wo = a.phases.flatMap((p) => p.workouts || []);
    for (const w of wo)
      await ops.create.mutateAsync({
        date: today(),
        name: w.name,
        items: w.items
          .filter((x) => db?.EXM[x.id])
          .map((x) => ({ id: x.id, sets: +x.sets || 3, reps: x.reps || '' })),
        src: 'archive' as never,
        at: Date.now(),
      });
    setGot({ ...got, [j]: true });
  };
  return (
    <Card className="gap-0">
      <span className="text-sm text-muted-foreground">🗂 {t('Прошлые планы')}</span>
      <div className="mb-1.5 text-[0.78rem] text-muted-foreground">
        {t(
          'Когда тренер меняет план, старый сохраняется здесь. Тренировки из него можно забрать себе и заниматься самому.',
        )}
      </div>
      {A.map((_, i) => A.length - 1 - i).map((j) => {
        const a = A[j];
        if (!a) return null;
        const wo = a.phases.flatMap((p) => p.workouts || []);
        return (
          <details key={j} className="border-t border-[#2a2a2a] py-2" data-testid="plan-arch">
            <summary className="min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <b>{a.phases.map((p) => p.name).join(' → ') || t('План')}</b>
              <div className="text-[0.76rem] text-muted-foreground">
                {a.by || t('Тренер')} · {t('до')} {tx.fD(a.archivedAt)}
              </div>
            </summary>
            {a.phases.map((p, k) => (
              <div key={k} className="pt-1.5">
                <div className="text-[0.86rem]">
                  <b>{p.name}</b> <span className="text-muted-foreground">· {tx.kcal(p)}</span>
                </div>
                {(p.workouts || []).map((w, m) => (
                  <div key={m} className="ml-2 text-[0.78rem] text-[#bbb]">
                    🏋️ {w.name}:{' '}
                    {w.items
                      .map((x) => `${db?.EXM[x.id] ? name(x.id) : x.id} ${x.sets}×${x.reps || ''}`)
                      .join(', ')}
                  </div>
                ))}
                {(p.nutrition?.rules ?? []).length > 0 && (
                  <div className="ml-2 text-[0.78rem] text-[#bbb]">🥗 {p.nutrition.rules.join(' · ')}</div>
                )}
              </div>
            ))}
            {wo.length > 0 && (
              <Button
                variant="secondary"
                className="mt-2 w-full"
                disabled={got[j] || ops.create.isPending}
                onClick={() => void take(j)}
              >
                {got[j]
                  ? `✓ ${t('Сохранено в «Мои программы»')}`
                  : `📥 ${t('Забрать тренировки себе')} (${wo.length})`}
              </Button>
            )}
          </details>
        );
      })}
    </Card>
  );
}

/** sh-path прототипа (renderPath): «Мой путь». */
export function PathSheet() {
  const { t } = useTranslation();
  const { path, open } = useNav();
  const { data: P } = usePlan();
  const { data: profile } = useProfile();
  const ctx = useDayCtx();
  const tx = usePhText();
  const ph = curPhase(P);
  const i = P?.current || 0;
  const body = () => {
    if (!P || !ph || !profile) return <p className="opacity-60">{t('Тренер ещё не составил план.')}</p>;
    const ty = phTy(ph.type),
      pr = phProgress(P, profile.w, Date.now()),
      tg = target(profile as CalcProfile, today(), ctx(today()));
    const phases = P.phases ?? [];
    return (
      <>
        <div
          className="mb-3 rounded-[28px] p-5"
          style={{ background: `linear-gradient(160deg,${ty.c2},#141414 70%)` }}
          data-testid="path-hero"
        >
          <div className="text-[0.74rem] font-semibold tracking-[0.06em]" style={{ color: ty.c1 }}>
            {t('СЕЙЧАС')} · {t('ФАЗА')} {i + 1} {t('ИЗ')} {phases.length}
          </div>
          <span className="mx-auto mb-1.5 block size-[150px]">
            <PhaseArt type={ph.type} />
          </span>
          <h2 className="m-0 text-center text-[1.7rem]">{ph.name || t(ty.n)}</h2>
          <p className="mt-2 mb-3 text-center text-[0.92rem] leading-normal text-[#ddd]">{t(ty.d)}</p>
          {ph.note && (
            <div className="rounded-[14px] bg-black/30 px-3 py-2.5 text-[0.88rem] leading-snug">
              💬 <b>{P.by || t('Тренер')}:</b> {ph.note}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-black/30 px-3 py-2.5">
              <div className="text-[0.72rem] text-muted-foreground">{t('Норма в день')}</div>
              <b className="text-[1.2rem]">
                {tg.k} {t('ккал')}
              </b>
            </div>
            <div className="rounded-[14px] bg-black/30 px-3 py-2.5">
              <div className="text-[0.72rem] text-muted-foreground">{t('Белок')}</div>
              <b className="text-[1.2rem]">
                {tg.p} {t('г')}
              </b>
            </div>
          </div>
          <div className="mt-3.5 flex justify-between text-[0.8rem] text-muted-foreground">
            <span>{t('Прогресс фазы')}</span>
            <span>{tx.progress(pr)}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-[5px] bg-white/[.08]">
            <div
              className="h-full rounded-[5px]"
              style={{ width: `${Math.round((pr?.p ?? 0) * 100)}%`, background: ty.c1 }}
            />
          </div>
        </div>
        <PhExtras P={P} ph={ph} />
        <Card className="gap-0">
          <span className="text-sm text-muted-foreground">{t('Маршрут')}</span>
          <div className="mt-1.5">
            {phases.map((x, j) => {
              const c = phTy(x.type).c1;
              const nx = phases[j + 1];
              const cn2 = nx ? phTy(nx.type).c1 : '#FF5A0A';
              const dim = (col: string, k: number) =>
                j + k > i ? `color-mix(in srgb,${col} 40%,#2a2a2a)` : col;
              const q = phaseTarget(x, profile as CalcProfile, today());
              const wo = (x.workouts || []).length,
                nu = (x.nutrition?.rules ?? []).length || (x.nutrition?.menu ?? []).length;
              return (
                <div
                  key={j}
                  className={cn('relative grid grid-cols-[78px_44px_1fr] gap-x-2.5', j > i && 'opacity-80')}
                  data-testid="path-step"
                >
                  <div className="pt-[11px] text-right">
                    <span
                      className="inline-block rounded-full px-[9px] py-1 text-[0.68rem] font-bold whitespace-nowrap"
                      style={{ background: `color-mix(in srgb,${c} 22%,transparent)`, color: c }}
                    >
                      {j < i ? `✓ ${t('готово')}` : j === i ? t('сейчас') : `${t('Фаза')} ${j + 1}`}
                    </span>
                  </div>
                  <div className="relative flex justify-center">
                    <span
                      className="absolute top-[22px] -bottom-[22px] left-1/2 -ml-0.5 w-1 rounded-sm"
                      style={{ background: `linear-gradient(${dim(c, 0)},${dim(cn2, 1)})` }}
                    />
                    <span
                      className="relative z-[1] box-border flex size-11 items-center justify-center rounded-full border-2 bg-[#141414] p-1"
                      style={{
                        borderColor: dim(c, 0),
                        boxShadow: j === i ? `0 0 0 5px color-mix(in srgb,${c} 25%,transparent)` : undefined,
                        filter: j > i ? 'saturate(.35) brightness(.6)' : undefined,
                      }}
                    >
                      <PhaseArt type={x.type} />
                    </span>
                  </div>
                  <div className="min-w-0 pt-[9px] pb-6">
                    <b className={cn('text-[1.02rem]', j > i && 'text-[#9a9a9a]')}>
                      {x.name || t(phTy(x.type).n)}
                    </b>
                    <div className="mt-0.5 text-[0.8rem] whitespace-nowrap text-muted-foreground">
                      {q.flex
                        ? `🏋️ ${q.k} / 🛋 ${q.k2} ${t('ккал')}`
                        : `≈ ${q.k} ${t('ккал')} · ${q.p} ${t('г белка')}`}
                    </div>
                    <div className="mt-0.5 text-[0.74rem] text-muted-foreground">
                      {t('в день')}
                      {q.manual
                        ? ` · ${t('Ж')} ${q.f} · ${t('У')} ${q.c} ${t('г')}`
                        : +(x.pct ?? 0) && x.mode !== 'abs'
                          ? ` · ${(x.pct ?? 0) < 0 ? t('дефицит') : t('профицит')} ${Math.abs(x.pct ?? 0)}%`
                          : ` · ${t('без дефицита')}`}
                    </div>
                    <div className="mt-0.5 text-[0.8rem] text-muted-foreground">🏁 {tx.end(x)}</div>
                    {(wo > 0 || nu > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[0.72rem]">
                        {wo > 0 && (
                          <span className="rounded-full bg-white/[.06] px-[9px] py-1">
                            🏋️ {wo} {t('трен.')}
                          </span>
                        )}
                        {nu > 0 && (
                          <span className="rounded-full bg-white/[.06] px-[9px] py-1">🥗 {t('питание')}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-[78px_44px_1fr] gap-x-2.5 opacity-80">
              <div className="pt-[11px] text-right">
                <span
                  className="inline-block rounded-full px-[9px] py-1 text-[0.68rem] font-bold"
                  style={{
                    background: 'color-mix(in srgb,var(--orange) 22%,transparent)',
                    color: 'var(--orange)',
                  }}
                >
                  {t('финиш')}
                </span>
              </div>
              <div className="flex justify-center">
                <span
                  className="flex size-11 items-center justify-center rounded-full border-2 bg-[#141414] text-[1.1rem]"
                  style={{ borderColor: 'color-mix(in srgb,#FF5A0A 40%,#2a2a2a)' }}
                >
                  🏆
                </span>
              </div>
              <div className="pt-[9px]">
                <b className="text-[#9a9a9a]">{t('Цель достигнута')}</b>
              </div>
            </div>
          </div>
        </Card>
        <p className="text-[0.76rem] leading-snug text-muted-foreground">
          {t('План составил тренер')} {P.by || ''}.{' '}
          {t('Фазы переключаются сами, когда выполнено условие. Изменить план может только тренер.')}
        </p>
      </>
    );
  };
  return (
    <SheetPage open={path} onOpenChange={(o) => !o && open({ path: false })} title={t('Мой путь')}>
      {body()}
      {P && <Archive P={P} />}
    </SheetPage>
  );
}

/** phaseCelebrate прототипа: новый план или новая фаза показываются один раз. */
export function PhaseCelebrate() {
  const { t } = useTranslation();
  const { data: P } = usePlan();
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem('phSeen');
    } catch {
      return null;
    }
  });
  const ph = curPhase(P);
  if (!P || !ph) return null;
  const key = `${P.id || 'p'}:${P.current || 0}:${P.phaseStart || 0}`;
  if (seen === key) return null;
  const close = () => {
    try {
      localStorage.setItem('phSeen', key);
    } catch {
      /* без хранилища покажем ещё раз */
    }
    setSeen(key);
  };
  const ty = phTy(ph.type);
  return (
    <Drawer open onOpenChange={(o) => !o && close()}>
      <DrawerContent data-testid="phase-new">
        <div className="px-4 pb-6 text-center">
          <div className="text-[0.78rem] font-semibold tracking-[0.06em]" style={{ color: ty.c1 }}>
            {P.current > 0 ? t('НОВАЯ ФАЗА') : t('ТВОЙ ПЛАН ГОТОВ')}
          </div>
          <div className="mx-auto my-2.5 size-40">
            <PhaseArt type={ph.type} />
          </div>
          <DrawerTitle className="mb-2 text-[1.6rem]">{ph.name || t(ty.n)}</DrawerTitle>
          <p className="leading-normal text-[#ddd]">{t(ty.d)}</p>
          {ph.note && <p className="text-[0.88rem] text-muted-foreground">💬 {ph.note}</p>}
          <Button className="mt-3.5 w-full" onClick={close}>
            {t('Поехали')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
