import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { BeforeAfter } from '@fitbay/shared';
import { SheetPage } from '@/components/ui/sheet-page';
import { api } from '@/data/api';
import { useMyRequests, useNotifications, useTips, useTrainerOps, useTrainers, type PkgReq } from '@/data/trainers';
import { useNav, type CabView } from '@/nav/store';
import { fmtD, fmtT } from './format';

export interface Nt {
  ts: number;
  ic: string;
  bi: string;
  bc: string;
  title: string;
  text?: string;
  go: () => void;
}

const ntSeen = () => {
  try {
    return +(localStorage.getItem('ntSeen') ?? 0) || 0;
  } catch {
    return 0;
  }
};

/** ntItems() прототипа: уведомления клиента и тренера (сохраненные на сервере + выведенные из данных). */
export function useNtItems(): Nt[] {
  const { t, i18n } = useTranslation();
  const loc = i18n.language;
  const nav = useNav();
  const { data: notifs = [] } = useNotifications();
  const { data: reqs = [] } = useMyRequests();
  const { data: tips } = useTips();
  const { data: trainers = [] } = useTrainers();
  const { data: ba } = useQuery({ queryKey: ['before-after'], queryFn: () => api.getOne<BeforeAfter & { reviewedAt?: number; none?: boolean }>('before-after').catch(() => null) });
  const { data: trReqs = [] } = useQuery({
    queryKey: ['trainer-requests'],
    enabled: nav.isTrainer,
    retry: false,
    queryFn: () => api.call<{ items: PkgReq[] }>('GET', '/trainer/requests').then((r) => r.items),
  });
  const trName = (id?: string) => trainers.find((x) => x.id === id)?.name ?? t('Тренер');
  const toTrainer = (tid?: string) => () => tid && nav.open({ trainer: tid, bell: false });
  const toCab = (v: CabView) => () => (nav.open({ bell: false }), nav.setMode('clients'), nav.setCabView(v));
  const when = (ts?: number) => (ts ? `${fmtD(ts, loc)}, ${fmtT(ts, loc)}` : '');
  const L: Nt[] = [];

  for (const n of notifs) {
    const r = reqs.find((x) => x.id === n.req) ?? trReqs.find((x) => x.id === n.req);
    if (n.type === 'cancel' && n.by === 'trainer')
      L.push({ ts: n.at, bc: '#7BC67B', bi: '↩', ic: '📅', title: `${trName(n.trainer)}: ${t('отменил занятие')} ${when(n.start)}`, text: (n.reason ? `💬 ${n.reason} · ` : '') + t('Занятие осталось у тебя в пакете, можно записаться на другое время'), go: toTrainer(n.trainer) });
    else if (n.type === 'req_accepted' || n.type === 'req_declined')
      L.push({ ts: n.at, bc: n.type === 'req_accepted' ? '#7BC67B' : 'var(--orange)', bi: n.type === 'req_accepted' ? '✓' : '×', ic: '📦', title: `${trName(n.trainer)}: ${t(n.type === 'req_accepted' ? 'заявка принята' : 'заявка отклонена')}`, text: (r?.pkg?.name ?? '') + (r?.answer ? ` · ${r.answer}` : ''), go: toTrainer(n.trainer) });
    else if (n.type === 'sess_charged' || n.type === 'sess_returned')
      L.push({ ts: n.at, bc: n.type === 'sess_charged' ? 'var(--orange)' : '#7BC67B', bi: n.type === 'sess_charged' ? '−' : '+', ic: '🎫', title: `${trName(n.trainer)}: ${t(n.type === 'sess_charged' ? 'списал занятие вручную' : 'вернул тебе занятие')}`, text: `${r?.pkg?.name ?? ''}${r?.usage ? ` · ${t('осталось')} ${r.usage.left} ${t('из')} ${r.usage.tot}` : ''}`, go: toTrainer(n.trainer) });
    // кабинет тренера
    else if (n.type === 'booked') L.push({ ts: n.at, bc: '#7BC67B', bi: '✓', ic: '📅', title: `${t('Новая запись')}: ${n.name || t('Клиент')}`, text: when(n.start), go: toCab('sched') });
    else if (n.type === 'burned') L.push({ ts: n.at, bc: 'var(--orange)', bi: '🔥', ic: '📅', title: `${n.name || t('Клиент')}: ${t('поздняя отмена, занятие сгорело')}`, text: `${when(n.start)}${n.reason ? ` · 💬 ${n.reason}` : ''}`, go: toCab('sched') });
    else if (n.type === 'cancel') L.push({ ts: n.at, bc: 'var(--orange)', bi: '×', ic: '📅', title: `${t('Отмена записи')}: ${n.name || t('Клиент')}`, text: `${when(n.start)} ${t('снова свободно')}${n.reason ? ` · 💬 ${n.reason}` : ''}`, go: toCab('sched') });
    else if (n.type === 'request') L.push({ ts: n.at, bc: 'var(--orange)', bi: '+', ic: '📦', title: `${t('Новая заявка')}: ${r?.name || t('Клиент')}`, text: `${r?.pkg?.name ?? ''}${r?.pkg?.price ? ` · ${r.pkg.price}` : ''}${r?.msg ? ` · ${r.msg}` : ''}`, go: toCab('list') });
  }
  // пакет почти закончился
  for (const r of reqs.filter((x) => x.status === 'accepted' && x.sessions))
    if (r.usage && r.usage.left <= 2)
      L.push({ ts: r.answeredAt || r.at || 0, bc: 'var(--orange)', bi: '!', ic: '🎫', title: r.usage.left ? `${t('В пакете осталось занятий')}: ${r.usage.left}` : t('Пакет занятий закончился'), text: `${r.pkg?.name ?? ''} · ${t('пора продлить')}`, go: toTrainer(r.trainer) });
  // рекомендации тренера
  for (const x of tips?.items ?? [])
    L.push({ ts: x.ts, bc: 'var(--yellow)', bi: '!', ic: x.cat === 'train' ? '🏋️' : '🍽', title: `${x.from || t('Тренер')}: ${t(x.cat === 'train' ? 'рекомендация по тренировкам' : 'рекомендация по питанию')}`, text: x.text, go: () => nav.open({ tips: x.cat || 'food', bell: false }) });
  // проверка «до и после»
  if (ba && !ba.none && ba.reviewedAt && ba.status !== 'pending')
    L.push({ ts: ba.reviewedAt, bc: ba.status === 'verified' ? '#7BC67B' : 'var(--orange)', bi: ba.status === 'verified' ? '✓' : '!', ic: '📷', title: t(ba.status === 'verified' ? 'Фото «До и после» проверены' : 'Нужны другие фото «До и после»'), text: ba.note || '', go: () => (nav.open({ bell: false }), nav.setProf('top')) });
  return L.sort((a, b) => b.ts - a.ts).slice(0, 40);
}

/** Счетчик новых на колокольчике (renderBell). */
export function useBellCount(): number {
  const L = useNtItems();
  const seen = ntSeen();
  return L.filter((x) => x.ts > seen).length;
}

/** sh-notif прототипа: группы по дням, иконка с меткой, переход по нажатию. Открытие отмечает всё прочитанным. */
export function BellSheet() {
  const { t, i18n } = useTranslation();
  const { bell, open, isTrainer } = useNav();
  const L = useNtItems();
  const ops = useTrainerOps();
  const [s0, setS0] = useState(0);
  const [was, setWas] = useState(false);
  if (bell !== was) {
    setWas(bell);
    if (bell) {
      setS0(ntSeen());
      try {
        localStorage.setItem('ntSeen', String(Date.now()));
      } catch {
        /* нет хранилища */
      }
      ops.readAll.mutate();
    }
  }
  const loc = i18n.language === 'de' ? 'de-DE' : 'ru-RU';
  const day = (ts: number) => {
    const d = new Date(ts), td = new Date();
    td.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    const k = Math.round((+td - +dd) / 864e5);
    return k === 0 ? t('Сегодня') : k === 1 ? t('Вчера') : k < 7 ? d.toLocaleDateString(loc, { weekday: 'long' }) : d.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  };
  const g: { k: string; items: Nt[] }[] = [];
  for (const x of L) {
    const k = day(x.ts);
    const G = g.at(-1);
    if (G && G.k === k) G.items.push(x);
    else g.push({ k, items: [x] });
  }
  return (
    <SheetPage open={bell} onOpenChange={(o) => !o && open({ bell: false })} title={<span className="text-[2rem]">{t('Уведомления')}</span>}>
      {L.length ? (
        <div className="rounded-[26px] bg-card px-4 pb-1 pt-1.5" data-testid="bell-list">
          {g.map((G, gi) => (
            <div key={G.k + gi} style={{ borderTop: gi ? '1px solid #262626' : 0 }}>
              <div className="px-0.5 pb-1.5 pt-4 text-[0.82rem] font-semibold capitalize text-[#ddd]">{G.k}</div>
              {G.items.map((x, i) => (
                <button key={i} type="button" data-testid="nt" onClick={() => (open({ bell: false }), x.go())} className="flex w-full items-start gap-3.5 px-0.5 py-3 text-left">
                  <span className="relative grid size-12 flex-none place-items-center rounded-full bg-[#262626] text-[1.25rem]">
                    {x.ic}
                    <i className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full border-2 border-card text-[0.6rem] font-bold not-italic text-[#111]" style={{ background: x.bc }}>
                      {x.bi}
                    </i>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] leading-[1.35] text-white">{x.title}</span>
                    {x.text && <span className="mt-0.5 block text-[0.85rem] leading-[1.35] text-[#bbb]">{x.text}</span>}
                    <span className="mt-1 block text-[0.78rem] text-muted-foreground">
                      {day(x.ts)}, {fmtT(x.ts, i18n.language)}
                    </span>
                  </span>
                  {x.ts > s0 && <span className="mt-2 size-2 flex-none rounded-full bg-brand-orange" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[26px] bg-card px-[18px] py-6 text-center">
          <div className="text-[2rem]">🔔</div>
          <p className="mb-1.5 mt-2 text-muted-foreground">
            {t(isTrainer ? 'Пока уведомлений нет. Здесь появятся заявки, записи, отмены и выполненные рекомендации клиентов.' : 'Пока уведомлений нет. Здесь появятся рекомендации тренера и ответы на заявки.')}
          </p>
        </div>
      )}
    </SheetPage>
  );
}
