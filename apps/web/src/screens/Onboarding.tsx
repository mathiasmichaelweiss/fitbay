import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from 'lucide-react';
import { ACTS, target, type Activity, type Goal } from '@fitbay/calc';
import { CONSENT_VERSIONS, type Profile } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Field, FieldGroup } from '@/components/ui/field';
import { OptionCard } from '@/components/ui/option-card';
import { SingleToggle } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { today, useSaveProfile } from '@/data/hooks';
import { useNav } from '@/nav/store';

/** Онбординг: порт renderOnb из прототипа (5 шагов, те же тексты и проверки). */
const N = 5;
type Path = 'ai' | 'trainer' | 'code';
type Draft = { sex: 'm' | 'f'; birth: string; h: string; w: string; tw: string; act: Activity; goal: Goal };

const GOAL_OPTS: { goal: Goal; icon: string; bg: string; title: string; sub: string }[] = [
  { goal: 'lose', icon: '🔥', bg: 'rgba(255,90,10,.18)', title: 'Похудеть', sub: 'Мягкий дефицит, больше белка, чтобы сохранить мышцы' },
  { goal: 'recomp', icon: '⚖️', bg: 'rgba(242,183,5,.18)', title: 'Рекомпозиция', sub: 'Минус жир, плюс мышцы, вес почти не меняется' },
  { goal: 'gain', icon: '💪', bg: 'rgba(175,217,218,.18)', title: 'Набрать мышцы', sub: 'Небольшой профицит и силовые' },
  { goal: 'keep', icon: '🌿', bg: '#222', title: 'Держать форму', sub: 'Есть по норме без дефицита' },
];
const PATH_OPTS: { path: Path; icon: string; bg: string; title: string; sub: string }[] = [
  { path: 'ai', icon: '🤖', bg: 'rgba(242,183,5,.18)', title: 'Сам, с ИИ-коучем', sub: 'ИИ подскажет по питанию и соберёт тренировку под цель' },
  { path: 'trainer', icon: '🧑‍🏫', bg: 'rgba(175,217,218,.18)', title: 'Найти тренера', sub: 'Каталог тренеров: онлайн и в зале, пакеты и запись' },
  { path: 'code', icon: '🎟️', bg: 'rgba(255,90,10,.18)', title: 'У меня есть код тренера', sub: 'Тренер дал код или ссылку' },
];
const FEATURES = [
  ['📸', 'Фото еды → калории', 'Сфотографируй тарелку или опиши словами, ИИ посчитает.'],
  ['⭕', 'Закрывай кольца', 'Калории, белок, углеводы и жиры видно с первого взгляда.'],
  ['🏋️', 'Тренер или ИИ-коуч', 'Найди живого тренера или тренируйся с ИИ.'],
] as const;
const CONSENT_TEXT =
  'Я согласен(на) на обработку моих данных о питании, весе, теле и тренировках для расчёта нормы и советов (данные о здоровье, ст. 9 DSGVO). Описания и фото еды отправляются ИИ (Claude, Anthropic) только для расчёта. Согласие можно отозвать в «Мои данные».';

export function Onboarding({ initial }: { initial?: Profile | null }) {
  const { t, i18n } = useTranslation();
  const save = useSaveProfile();
  const setTab = useNav((s) => s.setTab);
  const setOnboarding = useNav((s) => s.setOnboarding);
  const [step, setStep] = useState(0);
  const [cons, setCons] = useState(!!initial?.consents.health);
  const [path, setPath] = useState<Path | null>(null);
  const [code, setCode] = useState('');
  const [d, setD] = useState<Draft>({
    sex: initial?.sex ?? 'm',
    birth: initial?.birth ?? '',
    h: initial?.h ? String(initial.h) : '',
    w: initial?.w ? String(initial.w) : '',
    tw: initial?.tw ? String(initial.tw) : '',
    act: initial?.act ?? 0,
    goal: initial?.goal ?? 'keep',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (s: string) => Number(s.replace(',', '.')) || 0;
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(N - 1, n)));
    window.scrollTo(0, 0);
  };

  const g = t('г');
  const profile = (): Profile => {
    const w = num(d.w);
    const tw = d.goal === 'keep' || !num(d.tw) ? w : num(d.tw);
    return {
      ...(initial ?? {}),
      sex: d.sex, birth: d.birth, h: num(d.h), w, tw, act: d.act, goal: d.goal,
      lang: i18n.language as Profile['lang'],
      consents: { ...(initial?.consents ?? {}), ...(cons ? { health: { v: CONSENT_VERSIONS.health, at: new Date().toISOString() } } : {}) },
      ...(path ? { path } : {}),
      ...(path === 'code' ? { trainerCode: code.trim().toUpperCase() } : {}),
      onboarded: new Date().toISOString(),
    };
  };

  const okAbout = !!d.birth && num(d.h) >= 120 && num(d.w) >= 35 && cons;
  const okPath = !!path && (path !== 'code' || code.trim().length >= 3);
  const ok = step === 2 ? okAbout : step === 4 ? okPath : true;
  const next = step === 0 ? t('Начать') : step === 4 ? t('Готово') : t('Дальше');

  const finish = () =>
    save.mutate(profile(), {
      onSuccess: () => {
        setOnboarding(false);
        setTab(path === 'trainer' || path === 'code' ? 'trainer' : 'today');
      },
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col px-[18px] pb-7 pt-5">
      <div className="mb-[22px] flex items-center gap-2.5">
        {step > 0 && (
          <Button variant="tile" size="icon" className="size-9" aria-label={t('Назад')} onClick={() => go(step - 1)}>
            <ChevronLeftIcon className="size-5" />
          </Button>
        )}
        <div className="flex flex-1 gap-1.5" aria-label={t('Шаг {{n}} из {{total}}', { n: step + 1, total: N })}>
          {Array.from({ length: N }, (_, i) => (
            <i key={i} className={cn('h-1 flex-1 rounded-sm transition-colors duration-300', i <= step ? 'bg-primary' : 'bg-[#2a2a2a]')} />
          ))}
        </div>
        {step === 0 && (
          <SingleToggle
            aria-label={t('Язык')}
            value={i18n.language === 'de' ? 'de' : 'ru'}
            onChange={(k) => void i18n.changeLanguage(k)}
            options={[
              { value: 'ru', label: 'RU' },
              { value: 'de', label: 'DE' },
            ]}
          />
        )}
      </div>

      <div key={step} className="flex flex-1 animate-in fade-in-0 slide-in-from-right-4 flex-col duration-300">
        {step === 0 && (
          <>
            <div className="mb-[26px] mt-1.5 flex" aria-hidden>
              {['var(--orange)', 'var(--yellow)', 'var(--teal)'].map((c, i) => (
                <span key={c} className="inline-block size-[58px] rounded-full border-[7px]" style={{ borderColor: c, marginLeft: i ? -14 : 0 }} />
              ))}
            </div>
            <H>{t('Привет! Это FitBay')}</H>
            <P>{t('Питание, тренировки и тренер в одном приложении. Настроим всё за минуту.')}</P>
            {FEATURES.map(([icon, title, sub]) => (
              <div key={title} className="mb-4 flex items-start gap-3.5">
                <span className="w-[34px] text-center text-2xl" aria-hidden>{icon}</span>
                <div>
                  <b>{t(title)}</b>
                  <div className="mt-0.5 text-[0.86rem] leading-snug text-muted-foreground">{t(sub)}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <H>{t('Какая у тебя цель?')}</H>
            <P>{t('От цели зависит норма калорий и белка. Поменять можно в любой момент.')}</P>
            <div role="radiogroup" aria-label={t('Цель')} className="grid gap-2.5">
              {GOAL_OPTS.map((o) => (
                <OptionCard
                  key={o.goal}
                  icon={o.icon}
                  iconBg={o.bg}
                  title={t(o.title)}
                  sub={t(o.sub)}
                  selected={d.goal === o.goal}
                  onClick={() => setD((x) => ({ ...x, goal: o.goal, ...(o.goal === 'keep' ? { tw: x.w } : {}) }))}
                />
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <H>{t('Немного о тебе')}</H>
            <P>{t('Нужно для расчёта нормы. Данные видишь только ты.')}</P>
            <div className="grid gap-3 rounded-xl bg-card p-4">
              <FieldGroup label={t('Пол')}>
                <SingleToggle value={d.sex} onChange={(v) => set('sex', v)} options={[{ value: 'm', label: t('Мужчина') }, { value: 'f', label: t('Женщина') }]} />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup label={t('Дата рождения')}>
                  <DatePicker
                    aria-label={t('Дата рождения')}
                    title={t('Дата рождения')}
                    value={d.birth}
                    onChange={(v) => set('birth', v)}
                    lang={i18n.language}
                    placeholder={t('Выберите дату')}
                    doneLabel={t('Готово')}
                    max="2012-12-31"
                  />
                </FieldGroup>
                <Field label={t('Рост, см')} inputMode="numeric" value={d.h} onChange={(e) => set('h', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('Вес сейчас, кг')} inputMode="decimal" value={d.w} onChange={(e) => set('w', e.target.value)} />
                {d.goal !== 'keep' && <Field label={t('Цель, кг')} inputMode="decimal" value={d.tw} onChange={(e) => set('tw', e.target.value)} />}
              </div>
              <FieldGroup label={t('Тренировок в неделю')}>
                <SingleToggle value={String(d.act)} onChange={(v) => set('act', Number(v) as Activity)} options={ACTS.map((a) => ({ value: String(a.value), label: a.label }))} />
              </FieldGroup>
            </div>
            <label htmlFor="ob-cons" className="mt-3.5 flex cursor-pointer items-start gap-3 rounded-[18px] bg-card p-3.5 text-[0.86rem] leading-[1.45]">
              <Checkbox id="ob-cons" className="mt-px" checked={cons} onCheckedChange={(v) => setCons(v === true)} />
              <span>{t(CONSENT_TEXT)}</span>
            </label>
          </>
        )}

        {step === 3 && <NormStep p={profile()} />}

        {step === 4 && (
          <>
            <H>{t('Как будешь заниматься?')}</H>
            <P>{t('Можно начать самому и подключить тренера позже.')}</P>
            <div role="radiogroup" aria-label={t('Как будешь заниматься?')} className="grid gap-2.5">
              {PATH_OPTS.map((o) => (
                <OptionCard key={o.path} icon={o.icon} iconBg={o.bg} title={t(o.title)} sub={t(o.sub)} selected={path === o.path} onClick={() => setPath(o.path)} />
              ))}
            </div>
            {path === 'code' && (
              <Field
                label={t('У меня есть код тренера')}
                className="mt-2"
                autoFocus
                placeholder={t('Например: ANDREJ')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}
              />
            )}
          </>
        )}

        <div className="mt-auto pt-[18px]">
          <Button className="w-full" disabled={!ok || save.isPending} onClick={() => (step < N - 1 ? go(step + 1) : finish())}>
            {next}
          </Button>
          {step === 0 && (
            <Button variant="ghost" className="mt-2 w-full rounded-md text-muted-foreground" onClick={() => go(1)}>
              {t('Пропустить')}
            </Button>
          )}
        </div>
      </div>
    </main>
  );

  function NormStep({ p }: { p: Profile }) {
    const tg = target(p, today());
    return (
      <>
        <H>{t('Твоя норма на день')}</H>
        <P>{t('Посчитали по формуле Миффлина-Сан Жеора с учётом цели и активности.')}</P>
        <div className="mb-2.5 rounded-xl bg-primary p-4 text-on-color">
          <div className="text-xs font-semibold tracking-[0.06em] opacity-70">{t('КАЛОРИИ')}</div>
          <div className="text-[4rem] font-extrabold leading-none tracking-[-0.03em]" data-testid="norm-kcal">
            {tg.k.toLocaleString(i18n.language === 'de' ? 'de-DE' : 'ru-RU')}
          </div>
          <div className="mt-1 text-[0.9rem] opacity-75">{t('ккал в день')}</div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              ['Белок', tg.p, 'var(--cream)', 'norm-p'],
              ['Углеводы', tg.c, 'var(--yellow)', 'norm-c'],
              ['Жиры', tg.f, 'var(--teal)', 'norm-f'],
            ] as const
          ).map(([n, v, c, id]) => (
            <div key={n} className="rounded-xl p-3.5 text-on-color" style={{ background: c }}>
              <div className="text-[0.72rem] opacity-70">{t(n)}</div>
              <b className="text-2xl" data-testid={id}>
                {v}
                {g}
              </b>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[0.8rem] leading-[1.45] text-muted-foreground">
          {t('Когда добавишь тренировку или прогулку, норма на этот день немного вырастет. Это ориентир, а не медицинская рекомендация.')}
        </p>
      </>
    );
  }
}

function H({ children }: { children: React.ReactNode }) {
  return <h1 className="m-0 mb-2 text-[1.9rem] font-extrabold leading-[1.1] tracking-[-0.01em]">{children}</h1>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mb-[18px] text-[0.95rem] leading-[1.45] text-muted-foreground">{children}</p>;
}
