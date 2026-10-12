import { useTranslation } from 'react-i18next';
import { CheckIcon } from 'lucide-react';
import { Tile } from '@/components/ui/tile';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { useMyBookings, useMyRequests, useTips, useTrainerOps, useTrainers, type Tip } from '@/data/trainers';
import { useNav } from '@/nav/store';
import { fmtD, fmtT } from './format';

/** trTile прототипа: следующее занятие с тренером или «Найти тренера»; остаток пакета. */
export function TrainerTile() {
  const { t, i18n } = useTranslation();
  const { data: bk } = useMyBookings();
  const { data: reqs = [] } = useMyRequests();
  const { data: trainers = [] } = useTrainers();
  const open = useNav((s) => s.open);
  const now = Date.now();
  const my = (bk?.items ?? []).filter((s) => s.start > now - 36e5).sort((a, b) => a.start - b.start);
  const n = my[0];
  const tr = n && trainers.find((x) => x.id === n.trainer);
  const u = reqs.filter((r) => r.status === 'accepted' && r.sessions).map((r) => r.usage).find(Boolean);
  const loc = i18n.language;
  let sub = n
    ? `${n.plan?.name ? `${n.plan.name} · ` : ''}${tr ? tr.name : ''} · ${n.place === 'gym' ? n.addr || t('Зал') : t('Онлайн')}${my.length > 1 ? ` · +${my.length - 1}` : ''}`
    : t('Онлайн и в зале, запись на свободное время');
  if (u) sub += ` · ${t('пакет')}: ${t('осталось')} ${u.left} ${t('из')} ${u.tot}`;
  return (
    <Tile
      full
      color="peach"
      className="min-h-[120px]"
      data-testid="tr-tile"
      onClick={() => (n ? open({ trainer: n.trainer }) : open({ catalog: true }))}
      label={t(n ? 'СЛЕДУЮЩАЯ ТРЕНИРОВКА С ТРЕНЕРОМ' : 'ТРЕНЕРЫ')}
      title={n ? `${fmtD(n.start, loc)}, ${fmtT(n.start, loc)}` : t('Найти тренера')}
      sub={sub}
    />
  );
}

/** tipTile / tipTile2 прототипа: последняя открытая рекомендация тренера по теме. */
export function TipTile({ cat }: { cat: 'food' | 'train' }) {
  const { t } = useTranslation();
  const { data } = useTips();
  const open = useNav((s) => s.open);
  const it = (data?.items ?? []).filter((x) => (x.cat || 'food') === cat);
  if (!it.length) return null;
  const op = it.filter((x) => !x.done);
  const last = op[0] ?? it[0]!;
  return (
    <Tile
      full
      color="teal"
      className="min-h-[120px]"
      data-testid={`tip-${cat}`}
      onClick={() => open({ tips: cat })}
      label={t(cat === 'train' ? 'ОТ ТРЕНЕРА · ТРЕНИРОВКИ' : 'ОТ ТРЕНЕРА')}
      title={<span className="leading-[1.3]">{op.length ? last.text : t('Все рекомендации выполнены')}</span>}
      sub={op.length ? `${op.length} ${t('открыто')} · ${last.from || t('Тренер')}` : t('Отличная работа')}
    >
      <span aria-hidden className="absolute right-4 top-4 size-3 rounded-full bg-brand-orange" />
    </Tile>
  );
}

/** sh-tips прототипа: рекомендации по теме, отметка «выполнено». */
export function TipsSheet() {
  const { t, i18n } = useTranslation();
  const { tips, open } = useNav();
  const { data } = useTips();
  const ops = useTrainerOps();
  const all = data?.items ?? [];
  const it = all.filter((x) => (x.cat || 'food') === tips);
  const loc = i18n.language;
  const toggle = (x: Tip) => ops.tips.mutate(all.map((y) => (y.id === x.id ? { ...y, done: !y.done, doneAt: !y.done ? Date.now() : null } : y)));
  return (
    <SheetPage open={!!tips} onOpenChange={(o) => !o && open({ tips: null })} title={t('От тренера')}>
      {it.length ? (
        it.map((x) => (
          <Card key={x.id} className="mb-2.5 flex-row items-start gap-3" style={{ opacity: x.done ? 0.55 : 1 }} data-testid="tip">
            <button
              type="button"
              aria-pressed={!!x.done}
              aria-label={t('Выполнено')}
              onClick={() => toggle(x)}
              className="grid size-11 flex-none place-items-center"
            >
              <span className="grid size-7 place-items-center rounded-full border-2 font-bold text-[#111]" style={{ borderColor: x.done ? '#7BC67B' : '#555', background: x.done ? '#7BC67B' : 'transparent' }}>
                {x.done && <CheckIcon className="size-4" strokeWidth={3} />}
              </span>
            </button>
            <div className="flex-1">
              <div className="text-[0.95rem] leading-[1.45]" style={{ textDecoration: x.done ? 'line-through' : 'none' }}>
                {x.text}
              </div>
              <div className="mt-1 text-[0.74rem] text-muted-foreground">
                {x.from || t('Тренер')} · {fmtD(x.ts, loc)}
                {x.done && x.doneAt ? ` · ${t('сделано')} ${fmtD(x.doneAt, loc)}` : ''}
              </div>
            </div>
          </Card>
        ))
      ) : (
        <p className="opacity-60">{t('Пока нет рекомендаций.')}</p>
      )}
    </SheetPage>
  );
}
