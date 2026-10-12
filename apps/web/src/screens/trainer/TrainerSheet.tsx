import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pkgPrice, rates, type GenCfg, type Usage } from '@fitbay/calc';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SingleToggle } from '@/components/ui/toggle-group';
import { askConfirm, askReason } from '@/components/ui/confirm';
import { ApiError } from '@/data/api';
import { myName, saveName, useMyLinks, useMyRequests, useTrainer, useTrainerOps, useTrainerSlots, type PkgReq, type Slot, type Trainer } from '@/data/trainers';
import { useNav } from '@/nav/store';
import { useEx } from '@/screens/train/exercises';
import { startWorkout } from '@/screens/train/store';
import { Avatar } from './Catalog';
import { fmtD, fmtT, dayKey } from './format';

const REQ_ST: Record<PkgReq['status'], string> = { new: 'Заявка отправлена', accepted: 'Тренер принял заявку', declined: 'Тренер отклонил заявку' };

/** usageHtml прототипа: осталось занятий из пакета с полосой. */
export function UsageBar({ u, big }: { u: Usage | null | undefined; big?: boolean }) {
  const { t } = useTranslation();
  if (!u) return null;
  const c = u.left <= 2 ? 'var(--orange)' : '#7BC67B';
  return (
    <div className={big ? 'mt-2.5' : 'mt-1.5'} data-testid="usage">
      <div className={`flex justify-between ${big ? 'text-[0.9rem]' : 'text-[0.8rem]'}`}>
        <span>
          {t('Осталось')} <b style={{ color: c }}>{u.left}</b> {t('из')} {u.tot}
        </span>
        {u.left <= 2 && <span className="text-[0.76rem] text-brand-orange">{u.left ? t('пора продлить') : t('пакет закончился')}</span>}
      </div>
      <div className="mt-[5px] h-1.5 overflow-hidden rounded-[3px] bg-[#2a2a2a]">
        <i className="block h-full" style={{ width: `${u.pct * 100}%`, background: c }} />
      </div>
    </div>
  );
}

/** sh-tr прототипа (renderTrainer): карточка, «Поделиться», мои записи, пакеты и генератор, свободные окна. */
export function TrainerSheet() {
  const { t, i18n } = useTranslation();
  const { trainer: tid, open, setMode } = useNav();
  const { data: tr } = useTrainer(tid);
  const { data: slots = [] } = useTrainerSlots(tid);
  const { data: links = [] } = useMyLinks();
  const ops = useTrainerOps();
  const { db } = useEx();
  const [name, setName] = useState(myName());
  const [err, setErr] = useState('');
  const loc = i18n.language;
  if (!tid) return null;
  const now = Date.now();
  const mine = slots.filter((s) => s.bookedBy && s.start > now - 36e5);
  const free = slots.filter((s) => !s.bookedBy && s.start > now + 18e5 && s.start < now + 15 * 864e5);
  const by: Record<string, Slot[]> = {};
  for (const s of free) (by[dayKey(s.start)] ??= []).push(s);
  const shared = links.some((l) => l.trainer === tid && l.consent);

  const book = async (s: Slot) => {
    setErr('');
    const n = name.trim();
    if (!n) return setErr(t('Напиши, как тебя записать.'));
    saveName(n);
    if (!(await askConfirm(`${tr?.name ?? ''}: ${fmtD(s.start, loc)}, ${fmtT(s.start, loc)} · ${s.place === 'gym' ? s.addr || t('Зал') : t('Онлайн')}`, t('Записаться'), t('Отмена')))) return;
    try {
      await ops.book.mutateAsync({ tid, id: s.id, name: n });
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 409 ? t('Этот слот уже заняли. Выбери другое время.') : t('Не удалось записаться, попробуй еще раз.'));
    }
  };
  const cancel = async (s: Slot) => {
    const late = s.start - Date.now() < 864e5;
    const rs = late
      ? await askReason(t('До занятия меньше 24 часов. Если отменить сейчас, занятие сгорит и спишется из пакета.'), t('Отменить, занятие сгорит'), t('Оставить запись'), t('Причина для тренера (необязательно)'))
      : await askReason(t('Бесплатная отмена: до занятия больше 24 часов, оно останется в твоём пакете.'), t('Отменить запись'), t('Оставить'), t('Причина для тренера (необязательно)'));
    if (rs !== null) await ops.cancel.mutateAsync({ tid, id: s.id, reason: rs }).catch(() => {});
  };

  return (
    <SheetPage open onOpenChange={(o) => !o && open({ trainer: null })} title={tr?.name ?? ''}>
      {tr && (
        <div className="grid gap-3">
          <Card className="gap-0">
            <div className="flex items-center gap-4">
              <Avatar t={tr} size={72} />
              <div>
                <div className="text-[0.85rem] text-muted-foreground">
                  {t(tr.level || '')}
                  {tr.city ? ` · ${tr.city}` : ''}
                </div>
                <div className="mt-1 text-[1.25rem] font-bold">{tr.price || ''}</div>
              </div>
            </div>
            {(tr.about || tr.bio) && <p className="mb-2.5 mt-3.5 text-[0.92rem] leading-normal">{tr.about || tr.bio}</p>}
            <div>
              {(tr.tags ?? []).map((x) => (
                <span key={x} className="mb-1.5 mr-1.5 inline-block rounded-full bg-[#262626] px-2.5 py-1 text-[0.74rem]">
                  {t(x)}
                </span>
              ))}
            </div>
            {(tr.formats ?? []).length > 0 && (
              <div className="mt-1.5 text-[0.84rem] text-muted-foreground">
                {t('Форматы')}: {(tr.formats ?? []).map((x) => t(x)).join(', ')}
              </div>
            )}
            <Button variant="secondary" className="mt-3.5 h-12 w-full" onClick={() => !shared && open({ share: tid })}>
              {shared ? t('Тренер уже видит твои данные') : t('Поделиться данными с тренером')}
            </Button>
          </Card>

          {mine.length > 0 && (
            <Card className="gap-0" data-testid="my-bookings">
              <span className="text-sm text-muted-foreground">{t('Твои записи')}</span>
              {mine.map((s) => (
                <div key={s.id}>
                  <div className="flex items-center gap-2.5 border-t border-[#2a2a2a] py-2.5 first:border-t-0">
                    <div className="flex-1">
                      <b>
                        {fmtD(s.start, loc)}, {fmtT(s.start, loc)}
                      </b>
                      <div className="text-[0.8rem] text-muted-foreground">
                        {s.dur || 60} {t('мин')} · {s.place === 'gym' ? s.addr || t('Зал') : t('Онлайн')}
                      </div>
                    </div>
                    {s.burned ? (
                      <span className="text-[0.8rem] font-bold text-brand-orange">🔥 {t('отменено, сгорело')}</span>
                    ) : (
                      <Button variant="secondary" className="h-11 rounded-[14px] text-brand-orange" onClick={() => cancel(s)}>
                        {t('Отменить')}
                      </Button>
                    )}
                  </div>
                  {s.plan && (s.plan.items ?? []).length > 0 && (
                    <div className="mb-2.5 rounded-2xl bg-[#1f1f1f] px-3.5 py-3">
                      <div className="text-[0.72rem] font-semibold tracking-[.06em] text-brand-yellow">{t('К ЧЕМУ ГОТОВИТЬСЯ')}</div>
                      <b className="mt-1 block">{s.plan.name ?? ''}</b>
                      {(s.plan.items ?? []).map((x, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-2" style={{ borderTop: i ? '1px solid #2a2a2a' : 0 }}>
                          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-[#262626] text-[0.72rem]">{i + 1}</span>
                          <span className="min-w-0 flex-1">{db?.EXM[x.id] ? db.exName(db.EXM[x.id], i18n.language === 'de' ? 'de' : 'ru') : x.name || ''}</span>
                          <span className="whitespace-nowrap text-[0.85rem] text-muted-foreground">
                            {x.sets || 3}×{x.reps || '10'}
                          </span>
                        </div>
                      ))}
                      {s.plan.note && <div className="mt-2 text-[0.84rem] leading-snug text-muted-foreground">💡 {s.plan.note}</div>}
                      <Button
                        variant="secondary"
                        className="mt-2.5 h-11 w-full"
                        onClick={() => {
                          open({ trainer: null, catalog: false });
                          setMode('train');
                          startWorkout(
                            { id: '', date: '', at: 0, name: s.plan!.name ?? t('Тренировка'), items: (s.plan!.items ?? []).map((x) => ({ id: x.id, sets: x.sets ?? 3, reps: x.reps ?? '' })) },
                            t('Тренировка'),
                            t('кг'),
                            (id) => !!db?.EXM[id],
                          );
                        }}
                      >
                        {t('Начать эту тренировку')}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}

          <Packages tr={tr} />

          <Card className="gap-0" data-testid="free-slots">
            <span className="text-sm text-muted-foreground">{t('Разовая тренировка')}</span>
            <div className="mb-2 text-[0.82rem] leading-snug text-muted-foreground">
              {t('Свободные окна тренера')} {tr.name}. {t('Выбери время и запишись на одну тренировку. Если хочешь заниматься регулярно, выбери пакет выше.')}
            </div>
            <Field label={t('Как тебя записать')} value={name} placeholder={t('Имя')} onChange={(e) => setName(e.target.value)} />
            {Object.keys(by).length ? (
              Object.entries(by).map(([d, ss]) => (
                <div key={d} className="mt-3.5">
                  <div className="mb-2 text-[0.85rem] capitalize text-muted-foreground">{fmtD(ss[0]!.start, loc)}</div>
                  <div className="flex flex-wrap gap-2">
                    {ss.map((s) => (
                      <button key={s.id} type="button" data-testid="slot" onClick={() => book(s)} className="min-h-11 rounded-[14px] bg-[#262626] px-3.5 py-2.5 text-left text-[0.9rem]">
                        <b>{fmtT(s.start, loc)}</b>
                        <div className="text-[0.7rem] text-muted-foreground">
                          {s.place === 'gym' ? t('Зал') : t('Онлайн')} · {s.dur || 60} {t('мин')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="mb-0 opacity-60">{t('Свободных слотов на ближайшие 2 недели нет.')}</p>
            )}
            {err && (
              <div role="alert" className="mt-2 text-sm text-brand-orange">
                {err}
              </div>
            )}
          </Card>
        </div>
      )}
    </SheetPage>
  );
}

/** pkgCardHtml + genHtml прототипа: пакеты тренера, заявка, свой пакет с ценой. */
function Packages({ tr }: { tr: Trainer }) {
  const { t } = useTranslation();
  const { data: reqs = [] } = useMyRequests();
  const ops = useTrainerOps();
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [ct, setCt] = useState('');
  const [err, setErr] = useState('');
  const [gen, setGen] = useState(false);
  const [cfg, setCfg] = useState<GenCfg>({ freq: 2, place: 'online', months: 3, food: true });
  const P = tr.packages ?? [];
  const r = rates(tr);
  const canGym = r.gym > 0, canOn = r.on > 0;
  const c: GenCfg = { ...cfg, place: cfg.place === 'gym' && !canGym ? 'online' : cfg.place === 'online' && !canOn ? 'gym' : cfg.place };
  const p = pkgPrice(r, c);
  const rq = reqs.find((x) => x.trainer === tr.id && x.pkg?.id === 'gen');
  const genName = (x: GenCfg) => `${t('Свой пакет')}: ${x.freq}×/${t('нед')}, ${t(x.place === 'gym' ? 'зал' : 'онлайн')}, ${x.months} ${t(x.months === 1 ? 'мес' : 'мес.')}${x.food ? `, ${t('+ питание')}` : ''}`;
  const send = async (pkg: PkgReq['pkg'], m: string, contact: string, done: () => void) => {
    if (!contact.trim()) return setErr(t('Напиши, как с тобой связаться.'));
    setErr('');
    try {
      await ops.request.mutateAsync({ tid: tr.id, name: myName() || t('Клиент'), pkg, msg: m.trim(), contact: contact.trim() });
      done();
    } catch {
      setErr(t('Не удалось отправить, попробуй еще раз.'));
    }
  };
  const form = (onSend: () => void, onCancel: () => void, msgLabel = true) => (
    <div className="mt-2.5 grid gap-2">
      {msgLabel && <Label htmlFor="rqMsg">{t('Цель и пожелания')}</Label>}
      <Textarea id="rqMsg" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('Например: хочу поставить технику приседа, удобно вечером')} />
      <Label htmlFor="rqCt">{t('Как с тобой связаться')}</Label>
      <Input id="rqCt" value={ct} onChange={(e) => setCt(e.target.value)} placeholder={t('Telegram, WhatsApp или телефон')} />
      <div className="text-[0.74rem] leading-snug text-muted-foreground">{t('Это заявка, не оплата. Тренер ответит, и вы договоритесь о старте.')}</div>
      <div className="flex gap-2">
        <Button variant="secondary" className="h-12 flex-1" onClick={onCancel}>
          {t('Отмена')}
        </Button>
        <Button className="h-12 flex-[1.4]" onClick={onSend} disabled={ops.request.isPending}>
          {t('Отправить заявку')}
        </Button>
      </div>
      {err && (
        <div role="alert" className="text-sm text-brand-orange">
          {err}
        </div>
      )}
    </div>
  );
  const status = (x: PkgReq) => (
    <div
      className="mt-2.5 rounded-[14px] px-3 py-2.5 text-[0.86rem]"
      style={{ background: x.status === 'accepted' ? 'rgba(123,198,123,.15)' : x.status === 'declined' ? 'rgba(255,90,10,.12)' : '#1f1f1f' }}
      data-testid="req-status"
    >
      <b>{t(REQ_ST[x.status])}</b>
      {x.answer && <div className="mt-1 opacity-85">{x.answer}</div>}
      {x.status === 'accepted' && <div className="mt-1 opacity-70">{t('Тренер свяжется с тобой и пришлет оплату.')}</div>}
      <UsageBar u={x.usage} />
    </div>
  );
  return (
    <Card className="gap-0" data-testid="packages">
      <span className="text-sm text-muted-foreground">{t('Пакеты')}</span>
      <div className="mb-1 text-[0.82rem] leading-snug text-muted-foreground">{t('Несколько тренировок или ведение со скидкой. Заявка ни к чему не обязывает: тренер ответит, и вы договоритесь.')}</div>
      {P.map((pk) => {
        const x = reqs.find((y) => y.trainer === tr.id && y.pkg?.id === pk.id);
        const op = openId === pk.id && (!x || x.status === 'declined');
        return (
          <div key={pk.id} className="border-t border-[#2a2a2a] pb-1 pt-3.5" data-testid="pkg">
            <div className="flex items-baseline justify-between gap-2.5">
              <b className="text-[1.02rem]">{pk.name}</b>
              <b className="whitespace-nowrap text-brand-yellow">{pk.price ?? ''}</b>
            </div>
            {pk.desc && <div className="mt-1 text-[0.86rem] leading-snug text-muted-foreground">{pk.desc}</div>}
            {x && !op ? (
              <>
                {status(x)}
                <div className="mt-2 flex gap-2">
                  {x.status === 'declined' && (
                    <Button variant="secondary" className="h-11 flex-1" onClick={() => setOpenId(pk.id)}>
                      {t('Отправить снова')}
                    </Button>
                  )}
                  {x.status === 'new' && (
                    <Button
                      variant="secondary"
                      className="h-11 flex-1 text-brand-orange"
                      onClick={async () => {
                        if (await askConfirm(t('Отозвать заявку?'), t('Отозвать'), t('Оставить'))) await ops.withdraw.mutateAsync({ tid: tr.id, id: x.id }).catch(() => {});
                      }}
                    >
                      {t('Отозвать заявку')}
                    </Button>
                  )}
                </div>
              </>
            ) : op ? (
              form(
                () => send({ id: pk.id, name: pk.name, price: pk.price ?? '' }, msg, ct, () => (setOpenId(null), setMsg(''))),
                () => setOpenId(null),
              )
            ) : (
              <Button variant="secondary" className="mt-2.5 h-11 w-full" onClick={() => (setOpenId(pk.id), setErr(''))}>
                {t('Оставить заявку')}
              </Button>
            )}
          </div>
        );
      })}
      {(canGym || canOn) && (
        <div className="mt-1 border-t border-[#2a2a2a] pt-3.5" data-testid="gen">
          {!gen ? (
            <>
              {rq && (
                <div className="mb-2.5 rounded-[14px] bg-[#1f1f1f] px-3 py-2.5 text-[0.86rem]">
                  <b>{rq.pkg.name}</b> · {rq.pkg.price}
                  <div className="mt-1" style={{ color: rq.status === 'accepted' ? '#7BC67B' : rq.status === 'declined' ? 'var(--orange)' : 'var(--muted-foreground)' }}>
                    {t(REQ_ST[rq.status])}
                    {rq.answer ? `: ${rq.answer}` : ''}
                  </div>
                  <UsageBar u={rq.usage} />
                </div>
              )}
              <Button className="h-12 w-full bg-brand-yellow font-semibold hover:bg-brand-yellow/90" onClick={() => setGen(true)}>
                {t(rq ? 'Собрать пакет заново' : 'Собрать свой пакет')}
              </Button>
            </>
          ) : (
            <div className="grid gap-2">
              <b className="text-[1.02rem]">{t('Свой пакет')}</b>
              <span className="text-[0.8rem] text-muted-foreground">{t('Тренировок в неделю')}</span>
              <SingleToggle className="flex-nowrap [&>*]:flex-1" value={String(c.freq)} onChange={(v) => setCfg({ ...c, freq: +v })} options={['1', '2', '3', '4'].map((v) => ({ value: v, label: v }))} />
              {canGym && canOn && (
                <>
                  <span className="text-[0.8rem] text-muted-foreground">{t('Формат')}</span>
                  <SingleToggle className="flex-nowrap [&>*]:flex-1" value={c.place} onChange={(v) => setCfg({ ...c, place: v })} options={[{ value: 'online', label: t('Онлайн') }, { value: 'gym', label: t('В зале') }]} />
                </>
              )}
              <span className="text-[0.8rem] text-muted-foreground">{t('Срок')}</span>
              <SingleToggle
                className="flex-nowrap [&>*]:flex-1"
                value={String(c.months)}
                onChange={(v) => setCfg({ ...c, months: +v })}
                options={[1, 3, 6].map((m) => ({ value: String(m), label: `${m} ${t('мес')}${+(r.dur[m] ?? 0) ? ` · −${r.dur[m]}%` : ''}` }))}
              />
              {r.vol.length > 0 && (
                <div className="text-[0.76rem] text-muted-foreground">
                  {t('Скидка за количество')}: {r.vol.map((v) => `${t('от')} ${v.min} ${t('трен.')} −${v.pct}%`).join(', ')}
                </div>
              )}
              {r.food > 0 && (
                <label className="mt-1 flex min-h-11 items-center gap-2.5 text-[0.9rem]">
                  <Checkbox checked={c.food} onCheckedChange={(v) => setCfg({ ...c, food: v === true })} /> {t('Ведение питания')}
                  <span className="text-[0.8rem] text-muted-foreground">
                    +{r.food} €/{t('мес')}
                  </span>
                </label>
              )}
              <div className="rounded-2xl bg-[#1f1f1f] p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.85rem] text-muted-foreground">{t('Итого')}</span>
                  <b className="text-[1.6rem] text-brand-yellow" data-testid="gen-total">
                    {p.total} €
                  </b>
                </div>
                <div className="mt-1 text-[0.82rem] leading-[1.45] text-muted-foreground">
                  {p.ses} {t('тренировок')} · {p.month} €/{t('мес')} · ~{p.perSes} € {t('за тренировку')}
                  {p.disc ? ` · ${t('скидка')} ${Math.round(p.disc * 100)}%${p.dP && p.vP ? ` (${t('срок')} ${p.dP}% + ${t('объём')} ${p.vP}%)` : ''} −${p.base - p.total} €` : ''}
                </div>
              </div>
              {form(
                () => send({ id: 'gen', name: genName(c), price: `${p.total} €`, cfg: c }, msg, ct, () => (setGen(false), setMsg(''))),
                () => setGen(false),
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
