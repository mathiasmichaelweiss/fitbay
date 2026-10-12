import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, XIcon } from 'lucide-react';
import type { Program, ProgramItem } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { askConfirm } from '@/components/ui/confirm';
import { usePrograms, useProgramOps } from '@/data/hooks';
import { useEx } from './exercises';
import { ExIcon } from './Library';
import { startWorkout, useTrain } from './store';

/** pe прототипа: черновик редактируемой программы. */
interface Draft {
  pe: { id: string; name: string; items: ProgramItem[] } | null;
  open: (p: Program, known: (id: string) => boolean) => void;
  add: (id: string) => void;
  set: (pe: Draft['pe']) => void;
}
export const useProgramDraft = create<Draft>((set, get) => ({
  pe: null,
  open: (p, known) => set({ pe: { id: p.id, name: p.name, items: p.items.filter((i) => known(i.id)).map((i) => ({ ...i })) } }),
  add: (id) => {
    const pe = get().pe;
    if (pe) set({ pe: { ...pe, items: [...pe.items, { id, sets: 3, reps: '8-12' }] } });
  },
  set: (pe) => set({ pe }),
}));

const swap = <T,>(L: T[], a: number, b: number) => {
  const n = [...L];
  [n[a], n[b]] = [n[b] as T, n[a] as T];
  return n;
};

/** sh-prog прототипа (renderProgs). */
export function ProgramsSheet() {
  const { t } = useTranslation();
  const { prog, progEmpty, active, set } = useTrain();
  const { data: programs = [] } = usePrograms();
  const { remove } = useProgramOps();
  const { db, name } = useEx();
  const openPE = useProgramDraft((s) => s.open);
  const known = (id: string) => !!db?.EXM[id];
  const start = async (p: Program) => {
    if (active && !(await askConfirm(t('Сейчас идет другая тренировка. Заменить ее?')))) return;
    startWorkout(p, t('Тренировка'), t('кг'), known);
  };
  return (
    <SheetPage open={prog} onOpenChange={(o) => !o && set({ prog: false })} title={t('Мои программы')}>
      {progEmpty && (
        <Button variant="secondary" className="mb-3 h-[52px] w-full" onClick={() => startWorkout(null, t('Тренировка'), t('кг'), known)}>
          {t('Пустая тренировка')}
        </Button>
      )}
      {programs.length ? (
        programs.map((p) => (
          <Card key={p.id} className="mb-2.5 gap-0" data-testid="program">
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="min-h-11 flex-1 text-left" onClick={() => openPE(p, known)}>
                <b>{p.name}</b> <PencilIcon className="inline size-3.5 opacity-50" />
              </button>
              <button
                type="button"
                aria-label={t('Удалить')}
                className="grid size-11 place-items-center opacity-50"
                onClick={async () => {
                  if (await askConfirm(t('Удалить программу?'))) remove.mutate(p.id);
                }}
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <button type="button" className="mb-2.5 mt-1.5 text-left text-[0.85rem] opacity-70" onClick={() => openPE(p, known)}>
              {p.items
                .filter((i) => known(i.id))
                .map((i) => `${name(i.id)} ${i.sets}×${i.reps || ''}`)
                .join(' · ')}
            </button>
            <Button className="w-full" onClick={() => start(p)}>
              {t('Начать')}
            </Button>
          </Card>
        ))
      ) : (
        <p className="opacity-60">{t('Программ пока нет. Сохрани тренировку как программу или попроси AI-тренера составить.')}</p>
      )}
    </SheetPage>
  );
}

/** sh-pe прототипа: название, упражнения с подходами и повторами, порядок, добавить, сохранить, начать, удалить. */
export function ProgramEditor() {
  const { t } = useTranslation();
  const { pe, set: setPe } = useProgramDraft();
  const { data: programs = [] } = usePrograms();
  const { update, remove } = useProgramOps();
  const { active, set } = useTrain();
  const { db, name } = useEx();
  const [err, setErr] = useState('');
  if (!pe || !db) return null;
  const L = pe.items;
  const patch = (items: ProgramItem[]) => setPe({ ...pe, items });
  const save = async () => {
    if (!L.length) return setErr(t('Добавь первое упражнение.')), false;
    const p = programs.find((x) => x.id === pe.id);
    try {
      await update.mutateAsync({ id: pe.id, name: pe.name.trim() || t('Тренировка'), items: L, at: p?.at || Date.now() });
      return true;
    } catch {
      setErr(t('Не удалось сохранить.'));
      return false;
    }
  };
  const close = () => (setPe(null), setErr(''));
  return (
    <SheetPage
      open
      onOpenChange={(o) => !o && close()}
      title={<Input value={pe.name} aria-label={t('Название программы')} onChange={(e) => setPe({ ...pe, name: e.target.value })} className="h-auto border-0 bg-transparent p-0 text-[1.2rem] font-bold" />}
    >
      {L.length ? (
        L.map((it, i) => (
          <Card key={`${it.id}-${i}`} className="mb-2.5 gap-0" data-testid="pe-item">
            <div className="flex items-start justify-between gap-2">
              <button type="button" className="flex flex-1 items-center gap-2.5 text-left" onClick={() => set({ ex: it.id })}>
                <ExIcon e={db.EXM[it.id]} size={48} />
                <b>{name(it.id)}</b>
              </button>
              <div className="flex gap-1">
                {i > 0 && (
                  <Button variant="secondary" size="icon" aria-label={t('Выше')} onClick={() => patch(swap(L, i - 1, i))}>
                    <ArrowUpIcon className="size-4" />
                  </Button>
                )}
                {i < L.length - 1 && (
                  <Button variant="secondary" size="icon" aria-label={t('Ниже')} onClick={() => patch(swap(L, i, i + 1))}>
                    <ArrowDownIcon className="size-4" />
                  </Button>
                )}
                <button type="button" aria-label={t('Удалить')} className="grid size-11 place-items-center opacity-50" onClick={() => patch(L.filter((_, k) => k !== i))}>
                  <XIcon className="size-5" />
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <Field
                label={t('Подходы')}
                type="number"
                inputMode="numeric"
                value={it.sets || 3}
                onChange={(e) => patch(L.map((x, k) => (k === i ? { ...x, sets: Math.max(1, +e.target.value || 1) } : x)))}
              />
              <Field label={t('Повторения')} value={it.reps || ''} placeholder="8-12" onChange={(e) => patch(L.map((x, k) => (k === i ? { ...x, reps: e.target.value } : x)))} />
            </div>
          </Card>
        ))
      ) : (
        <p className="opacity-60">{t('Добавь первое упражнение.')}</p>
      )}
      <Button variant="secondary" className="h-[52px] w-full" onClick={() => set({ lib: true, pick: 'prog' })}>
        + {t('Упражнение')}
      </Button>
      {err && (
        <div role="alert" className="mt-2 text-sm text-brand-orange">
          {err}
        </div>
      )}
      <Button className="mt-4 w-full" onClick={async () => (await save()) && close()}>
        {t('Сохранить')}
      </Button>
      <Button
        className="mt-2.5 w-full bg-brand-cream hover:bg-brand-cream/90"
        onClick={async () => {
          const snap = { ...pe };
          if (!(await save())) return;
          if (active && !(await askConfirm(t('Сейчас идет другая тренировка. Заменить ее?')))) return;
          close();
          startWorkout({ id: snap.id, name: snap.name, items: snap.items, date: '', at: 0 }, t('Тренировка'), t('кг'), (id) => !!db.EXM[id]);
        }}
      >
        {t('Сохранить и начать')}
      </Button>
      <Button
        variant="outline"
        className="mt-2.5 h-[52px] w-full rounded-lg border-[#333] text-brand-orange"
        onClick={async () => {
          if (await askConfirm(t('Удалить программу?'))) {
            remove.mutate(pe.id);
            close();
          }
        }}
      >
        {t('Удалить программу')}
      </Button>
    </SheetPage>
  );
}
