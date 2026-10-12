import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { askConfirm } from '@/components/ui/confirm';
import { api } from '@/data/api';
import { myName, useMyLinks, useTrainerOps, useTrainers, type Trainer } from '@/data/trainers';
import { useNav } from '@/nav/store';
import { cn } from '@/lib/utils';

/** sh-share прототипа: выбор тренера (или код), что увидит тренер, имя, два согласия (ст. 9 DSGVO). */
export function ShareSheet() {
  const { t } = useTranslation();
  const { share, open } = useNav();
  const { data: trainers = [] } = useTrainers();
  const ops = useTrainerOps();
  const [pick, setPick] = useState<string | null>(null);
  const [extra, setExtra] = useState<Trainer | null>(null);
  const [code, setCode] = useState('');
  const [ref, setRef] = useState<string | undefined>();
  const [name, setName] = useState(myName());
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [err, setErr] = useState('');
  const cur = pick ?? (typeof share === 'string' ? share : null);
  const list = extra && !trainers.some((x) => x.id === extra.id) ? [...trainers, extra] : trainers;
  const close = () => (open({ share: null }), setPick(null), setC1(false), setC2(false), setErr(''));
  const byCode = async () => {
    try {
      const x = await api.call<Trainer>('GET', `/trainers/by-code/${encodeURIComponent(code.trim().toUpperCase())}`);
      setExtra(x);
      setPick(x.id);
      setRef(code.trim().toUpperCase());
      setErr('');
    } catch {
      setErr(t('Код не найден. Проверь написание.'));
    }
  };
  const go = async () => {
    if (!c1 || !c2) return setErr(t('Отметь оба пункта, чтобы поделиться.'));
    if (!name.trim()) return setErr(t('Напиши, как тебя называть.'));
    if (!cur) return setErr(t('Выбери тренера.'));
    try {
      await ops.link.mutateAsync({ tid: cur, name: name.trim(), ref });
      close();
    } catch {
      setErr(t('Не удалось сохранить.'));
    }
  };
  return (
    <SheetPage open={!!share} onOpenChange={(o) => !o && close()} title={t('Поделиться с тренером')}>
      <div className="grid gap-3">
        <Card className="gap-0">
          <span className="text-sm text-muted-foreground">{t('Выбери тренера')}</span>
          <div className="mb-2.5 mt-1.5 flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Или введи код тренера')} aria-label={t('Или введи код тренера')} className="flex-1 uppercase" autoCapitalize="characters" />
            <Button variant="secondary" className="h-[46px]" onClick={byCode}>
              OK
            </Button>
          </div>
          {list.length ? (
            list.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={cur === x.id}
                onClick={() => setPick(x.id)}
                className={cn('mb-2 flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[#222] p-3 text-left', cur === x.id && 'border-brand-orange bg-[rgba(255,90,10,.18)]')}
              >
                <span className="grid size-11 flex-none place-items-center rounded-full font-bold text-[#111]" style={{ background: x.color || '#B2D8D8' }}>
                  {(x.name || '?')[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <b>{x.name}</b>
                  <div className="mt-0.5 text-[0.8rem] opacity-65">
                    {x.level || ''}
                    {x.city ? ` · ${x.city}` : ''}
                  </div>
                  <div className="text-[0.8rem] opacity-65">{x.bio || ''}</div>
                </span>
                <span className="whitespace-nowrap text-[0.85rem]">{x.price || ''}</span>
              </button>
            ))
          ) : (
            <div className="opacity-60">{t('Список тренеров загружается...')}</div>
          )}
        </Card>
        <Card className="gap-0 text-[0.92rem] leading-normal">
          <p className="mt-0">{t('Тренер будет видеть твои данные, чтобы вести тебя и давать рекомендации:')}</p>
          <ul className="mb-2.5 mt-0 pl-5">
            <li>{t('питание по дням: калории, белки, жиры, углеводы;')}</li>
            <li>{t('тренировки и активность;')}</li>
            <li>{t('вес, замеры тела и твою цель.')}</li>
          </ul>
          <p className="m-0 text-muted-foreground">{t('Это данные о здоровье (ст. 9 DSGVO), поэтому нужно твое явное согласие. Отозвать его можно в любой момент в настройках, тогда тренер сразу перестанет видеть данные.')}</p>
        </Card>
        <Card className="gap-2">
          <Field label={t('Как тебя называть тренеру')} value={name} placeholder={t('Имя')} onChange={(e) => setName(e.target.value)} />
          <label className="mt-2 flex items-start gap-2.5 leading-snug">
            <Checkbox className="mt-0.5" checked={c1} onCheckedChange={(v) => setC1(v === true)} />
            <span>{t('Я согласен(на), чтобы тренер видел мои данные о питании, тренировках, весе и замерах')}</span>
          </label>
          <label className="flex items-start gap-2.5 leading-snug">
            <Checkbox className="mt-0.5" checked={c2} onCheckedChange={(v) => setC2(v === true)} />
            <span>{t('Я понимаю, что могу отозвать согласие в любой момент')}</span>
          </label>
          {err && (
            <div role="alert" className="text-sm text-brand-orange">
              {err}
            </div>
          )}
        </Card>
        <Button className="w-full" onClick={go} disabled={ops.link.isPending}>
          {t('Даю согласие и делюсь')}
        </Button>
      </div>
    </SheetPage>
  );
}

/** shareBox прототипа в «Тело и цели»: кто видит данные, с какого дня, «Отозвать доступ». */
export function ShareBox() {
  const { t, i18n } = useTranslation();
  const { data: links = [] } = useMyLinks();
  const { data: trainers = [] } = useTrainers();
  const ops = useTrainerOps();
  const open = useNav((s) => s.open);
  const l = links.find((x) => x.consent);
  const nm = (id: string) => trainers.find((x) => x.id === id)?.name ?? id;
  return (
    <div className="mb-2.5 rounded-xl bg-card p-4" data-testid="share-box">
      <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Тренер')}</div>
      {l ? (
        <>
          <div className="text-[0.9rem] leading-[1.45]">
            ✅ {nm(l.trainer)} {t('видит твои данные с')} {new Date(l.since).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'ru-RU', { day: 'numeric', month: 'long' })}.
          </div>
          <Button
            variant="secondary"
            className="mt-2.5 h-12 w-full text-brand-orange"
            onClick={async () => {
              if (await askConfirm(t('Отозвать доступ тренера к твоим данным?'))) await ops.unlink.mutateAsync({ tid: l.trainer }).catch(() => {});
            }}
          >
            {t('Отозвать доступ')}
          </Button>
        </>
      ) : (
        <>
          <div className="text-[0.9rem] leading-[1.45] text-muted-foreground">{t('Тренер пока не видит твои данные.')}</div>
          <Button variant="secondary" className="mt-2.5 h-12 w-full" onClick={() => open({ share: true })}>
            {t('Поделиться с тренером')}
          </Button>
        </>
      )}
    </div>
  );
}
