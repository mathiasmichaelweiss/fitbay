import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { weightOn } from '@fitbay/calc';
import type { BeforeAfter, Measure } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { askConfirm } from '@/components/ui/confirm';
import { api } from '@/data/api';
import { today, useMeasureOps, useMeasures, useProfile, useSaveProfile, useWeighings } from '@/data/hooks';
import { resizeImage } from '@/lib/image';
import { useNav } from '@/nav/store';

/** MS прототипа: ключ, подпись, единица. */
export const MS: [keyof Measure, string, string][] = [
  ['weight', 'Вес', 'кг'],
  ['waist', 'Талия', 'см'],
  ['chest', 'Грудь', 'см'],
  ['hips', 'Бедра (ягодицы)', 'см'],
  ['thigh', 'Бедро', 'см'],
  ['biceps', 'Бицепс', 'см'],
  ['neck', 'Шея', 'см'],
  ['calf', 'Икра', 'см'],
];
const MS_BODY = ['waist', 'chest', 'hips', 'thigh', 'biceps', 'neck', 'calf'] as const;
const FIELDS: [keyof Measure, string][] = [
  ['waist', 'Талия'],
  ['chest', 'Грудь'],
  ['hips', 'Бедра (ягодицы)'],
  ['thigh', 'Бедро'],
  ['biceps', 'Бицепс'],
  ['neck', 'Шея'],
  ['calf', 'Икра'],
  ['weight', 'Вес, кг'],
];

/** Последний день с замером тела (msLast прототипа) и сколько дней назад. */
export function useMsDays(): number | null {
  const { data: list = [] } = useMeasures();
  const last = list.filter((m) => MS_BODY.some((k) => m[k] != null)).map((m) => m.date).sort().at(-1);
  if (!last) return null;
  return Math.round((Date.parse(`${today()}T12:00:00`) - Date.parse(`${last}T12:00:00`)) / 864e5);
}

/** msCard прототипа: замеры тела за сегодня и история последних 6 с разницей. */
export function MeasuresCard() {
  const { t, i18n } = useTranslation();
  const { data: list = [] } = useMeasures();
  const { data: profile } = useProfile();
  const { update } = useMeasureOps();
  const saveProf = useSaveProfile();
  const locale = i18n.language === 'de' ? de : ru;
  const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  const todays = sorted.find((m) => m.date === today());
  const [v, setV] = useState<Partial<Record<keyof Measure, string>>>({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const val = (k: keyof Measure) => v[k] ?? (todays?.[k] != null ? String(todays[k]) : '');
  const f = (x: number) => String(x).replace('.', ',');
  const save = async () => {
    const d: Partial<Measure> = {};
    let n = 0;
    for (const [k] of MS) {
      const x = parseFloat(String(val(k)).replace(',', '.'));
      if (x > 0) {
        (d as Record<string, number>)[k] = x;
        n++;
      }
    }
    if (!n) return setErr(t('Заполни хотя бы один замер.'));
    setErr('');
    try {
      await update.mutateAsync({ id: today(), date: today(), at: Date.now(), ...d });
      if (d.weight && profile) await saveProf.mutateAsync({ ...profile, w: d.weight });
      setV({});
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      setErr(t('Не удалось сохранить.'));
    }
  };
  return (
    <div className="mb-2.5 rounded-xl bg-card p-4" id="msCard" data-testid="ms-card">
      <div className="mb-2 text-[0.8rem] text-muted-foreground">{t('Замеры тела, см')}</div>
      <div className="grid grid-cols-2 gap-2.5">
        {FIELDS.map(([k, l]) => (
          <Field
            key={k}
            label={t(l)}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={val(k)}
            placeholder={k === 'weight' ? String(profile?.w ?? '') : ''}
            onChange={(e) => setV({ ...v, [k]: e.target.value })}
          />
        ))}
      </div>
      <Button className="mt-3.5 w-full" onClick={save} disabled={update.isPending}>
        {ok ? t('Сохранено') : t('Сохранить замер за сегодня')}
      </Button>
      {err && (
        <div role="alert" className="mt-2 text-sm text-brand-orange">
          {err}
        </div>
      )}
      {sorted.length > 0 && (
        <div className="mt-3.5" data-testid="ms-hist">
          <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('История замеров')}</div>
          {sorted.slice(0, 6).map((m, i) => {
            const prev = sorted[i + 1];
            return (
              <div key={m.date} className="border-t border-[#2a2a2a] py-2 text-[0.85rem]">
                <b>{format(parseISO(m.date), 'd MMM', { locale })}</b>
                <div className="mt-0.5 opacity-80">
                  {MS.filter(([k]) => m[k] != null).map(([k, n], j) => {
                    const x = prev?.[k] != null ? Math.round((+m[k]! - +prev[k]!) * 10) / 10 : 0;
                    return (
                      <span key={k}>
                        {j ? ' · ' : ''}
                        {t(n)} {f(+m[k]!)}
                        {x ? <span style={{ color: x < 0 ? '#7BC67B' : 'var(--orange)' }}> {`${x > 0 ? '+' : ''}${f(x)}`}</span> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** msRemind прототипа: раз в неделю, только на сегодня, «Позже» откладывает на сутки. */
export function MsRemindTile() {
  const { t } = useTranslation();
  const { isSuccess } = useMeasures();
  const d = useMsDays();
  const setProf = useNav((s) => s.setProf);
  const [, re] = useState(0);
  let snooze = 0;
  try {
    snooze = +(localStorage.getItem('msSnooze') ?? 0) || 0;
  } catch {
    /* нет хранилища */
  }
  const due = isSuccess && (d === null || d >= 7) && Date.now() > snooze;
  if (!due) return null;
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="ms-remind"
      onClick={() => setProf('ms')}
      onKeyDown={(e) => e.key === 'Enter' && setProf('ms')}
      className="col-span-full flex cursor-pointer items-center gap-3.5 rounded-xl bg-brand-yellow px-[18px] py-4 text-on-color"
    >
      <span className="text-[1.8rem]">📏</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[1.05rem]">{t('Пора замериться')}</b>
        <span className="text-[0.82rem] opacity-75">
          {d === null ? t('Талия, бёдра, бицепс: 2 минуты, и прогресс видно не только по весу.') : `${t('Последний замер')} ${d} ${t('дн. назад')}. ${t('Раз в неделю, в одно время, лучше утром.')}`}
        </span>
      </span>
      <button
        type="button"
        className="min-h-11 rounded-full bg-black/10 px-3 text-[0.8rem] font-semibold"
        onClick={(e) => {
          e.stopPropagation();
          try {
            localStorage.setItem('msSnooze', String(Date.now() + 864e5));
          } catch {
            /* нет хранилища */
          }
          re((x) => x + 1);
        }}
      >
        {t('Позже')}
      </button>
    </div>
  );
}

const BA_ST: Record<NonNullable<BeforeAfter['status']>, string> = { draft: 'Черновик', pending: 'На проверке', verified: 'Проверено ✓', rejected: 'Нужны другие фото' };

/** baCard прототипа: фото «до» и «после» с датой и весом, отправка на проверку с согласием на публикацию. */
export function BeforeAfterCard() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data: saved = null } = useQuery({ queryKey: ['before-after'], queryFn: () => api.getOne<BeforeAfter>('before-after') });
  const put = useMutation({ mutationFn: (d: BeforeAfter | { none: true }) => api.putOne('before-after', d), onSuccess: () => qc.invalidateQueries({ queryKey: ['before-after'] }) });
  const { data: profile } = useProfile();
  const weights = useWeighings();
  const [draft, setDraft] = useState<BeforeAfter | null>(null);
  const [err, setErr] = useState('');
  const [pub, setPub] = useState<boolean | null>(null);
  const [hide, setHide] = useState<boolean | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const slotRef = useRef<'before' | 'after'>('before');
  const locale = i18n.language === 'de' ? de : ru;
  const real = saved && !(saved as { none?: boolean }).none ? saved : null;
  const d = draft ?? real ?? {};
  const st = d.status ?? 'draft';
  const locked = !draft && (st === 'pending' || st === 'verified');
  const dw = d.before?.w && d.after?.w ? Math.round((d.after.w - d.before.w) * 10) / 10 : null;
  const onFile = async (f?: File) => {
    if (!f) return;
    const img = await resizeImage(f, 560, 0.62);
    const day = today();
    setDraft({ ...(draft ?? structuredClone(real ?? {})), status: 'draft', [slotRef.current]: { img, date: day, w: weightOn(weights, day, profile?.w ?? 0) } });
  };
  const slot = (k: 'before' | 'after', l: string) => {
    const x = d[k];
    return (
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-[0.78rem] text-muted-foreground">{t(l)}</div>
        {x?.img ? (
          <img src={x.img} alt={t(l)} className="block aspect-[3/4] w-full rounded-[14px] object-cover" />
        ) : (
          <div className="grid aspect-[3/4] w-full place-items-center rounded-[14px] border-[1.5px] border-dashed border-[#3a3a3a] text-[0.8rem] text-muted-foreground">{t('Нет фото')}</div>
        )}
        <div className="mt-1.5 text-[0.78rem]">{x?.date ? `${format(parseISO(x.date), 'd MMM', { locale })}${x.w ? ` · ${x.w} ${t('кг')}` : ''}` : ' '}</div>
        {!locked && (
          <Button variant="secondary" className="mt-1.5 h-11 w-full text-[0.82rem]" onClick={() => ((slotRef.current = k), file.current?.click())}>
            {x?.img ? t('Заменить') : t('Добавить фото')}
          </Button>
        )}
      </div>
    );
  };
  return (
    <div className="mb-2.5 rounded-xl bg-card p-4" data-testid="ba-card">
      <div className="mb-2 text-[0.8rem] text-muted-foreground">{t('До и после')}</div>
      <p className="mb-2.5 mt-0 text-[0.8rem] leading-snug text-muted-foreground">{t('Сфотографируйся в одинаковой позе и свете. После проверки командой кейс можно опубликовать, за это 3 месяца приложения бесплатно.')}</p>
      <div className="flex gap-2.5">
        {slot('before', 'До')}
        {slot('after', 'После')}
      </div>
      {dw != null && (
        <div className="mt-2.5 font-semibold">
          {t('Разница')}:{' '}
          <span style={{ color: dw < 0 ? '#7BC67B' : 'var(--orange)' }}>
            {dw > 0 ? '+' : ''}
            {dw} {t('кг')}
          </span>
        </div>
      )}
      <div className="mt-3 text-[0.85rem]">
        {t('Статус')}: <b>{t(BA_ST[st])}</b>
        {d.note && <div className="mt-1 text-muted-foreground">{d.note}</div>}
      </div>
      {locked ? (
        st === 'pending' && (
          <Button variant="secondary" className="mt-2.5 h-11 w-full" onClick={() => setDraft({ ...structuredClone(real ?? {}), status: 'draft' })}>
            {t('Изменить')}
          </Button>
        )
      ) : (
        <>
          <label className="mt-3 flex items-start gap-2.5 text-[0.84rem] leading-snug">
            <Checkbox className="mt-0.5" checked={pub ?? !!d.consent?.publish} onCheckedChange={(x) => setPub(x === true)} />
            {t('Разрешаю опубликовать фото как кейс в соцсетях FitBay. Согласие можно отозвать в любой момент.')}
          </label>
          <label className="mt-2 flex items-start gap-2.5 text-[0.84rem] leading-snug">
            <Checkbox className="mt-0.5" checked={hide ?? !!d.consent?.hideFace} onCheckedChange={(x) => setHide(x === true)} />
            {t('Скрыть лицо при публикации')}
          </label>
          <Button
            className="mt-3 w-full"
            onClick={async () => {
              if (!(d.before?.img && d.after?.img)) return setErr(t('Добавь оба фото: до и после.'));
              setErr('');
              try {
                await put.mutateAsync({ ...d, status: 'pending', note: '', consent: { publish: pub ?? !!d.consent?.publish, hideFace: hide ?? !!d.consent?.hideFace, at: Date.now(), version: 1 }, sentAt: Date.now() });
                setDraft(null);
              } catch {
                setErr(t('Не удалось отправить.'));
              }
            }}
          >
            {t('Отправить на проверку')}
          </Button>
          {err && (
            <div role="alert" className="mt-2 text-sm text-brand-orange">
              {err}
            </div>
          )}
        </>
      )}
      {real && (
        <Button
          variant="secondary"
          className="mt-2.5 h-11 w-full text-brand-orange"
          onClick={async () => {
            if (await askConfirm(t('Удалить фото «до и после» и отозвать согласие на публикацию?'))) {
              await put.mutateAsync({ none: true });
              setDraft(null);
            }
          }}
        >
          {t('Удалить фото и отозвать согласие')}
        </Button>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}
