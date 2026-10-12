import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { target } from '@fitbay/calc';
import { CONSENT_VERSIONS, type ConsentKind, type Profile } from '@fitbay/shared';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Field, FieldGroup } from '@/components/ui/field';
import { Tile, Tiles } from '@/components/ui/tile';
import { SingleToggle } from '@/components/ui/toggle-group';
import { today, useSaveProfile } from '@/data/hooks';

type Draft = Omit<Profile, 'consents' | 'h' | 'w' | 'tw'> & { h: string; w: string; tw: string };

export function Onboarding({ initial }: { initial?: Profile | null }) {
  const { t, i18n } = useTranslation();
  const save = useSaveProfile();
  const [step, setStep] = useState(1);
  const [agree, setAgree] = useState<Record<ConsentKind, boolean>>({
    health: !!initial?.consents.health,
    privacy: !!initial?.consents.privacy,
    trainer: !!initial?.consents.trainer,
  });
  const [d, setD] = useState<Draft>({
    sex: initial?.sex ?? 'm',
    birth: initial?.birth ?? '',
    h: initial?.h ? String(initial.h) : '',
    w: initial?.w ? String(initial.w) : '',
    tw: initial?.tw ? String(initial.tw) : '',
    act: initial?.act ?? 'light',
    goal: initial?.goal ?? 'keep',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (s: string) => Number(s.replace(',', '.'));

  const okConsents = agree.health && agree.privacy;
  const okAbout = /^\d{4}-\d{2}-\d{2}$/.test(d.birth) && num(d.h) >= 100 && num(d.h) <= 250 && num(d.w) >= 30 && num(d.w) <= 300;

  const profile = (): Profile => {
    const at = new Date().toISOString();
    const consents: Profile['consents'] = {};
    for (const k of Object.keys(agree) as ConsentKind[]) if (agree[k]) consents[k] = { v: CONSENT_VERSIONS[k], at };
    return {
      sex: d.sex, birth: d.birth, h: num(d.h), w: num(d.w), act: d.act, goal: d.goal,
      ...(d.tw ? { tw: num(d.tw) } : {}),
      lang: i18n.language as Profile['lang'],
      consents,
    };
  };
  const preview = okAbout ? target(profile(), today()) : null;
  const titles = ['', t('onb.welcome'), t('onb.aboutTitle'), t('onb.goalTitle')];

  return (
    <main className="mx-auto grid max-w-[480px] gap-4 px-4 pb-8 pt-6">
      <header>
        <p className="m-0 text-sm text-muted-foreground">{t('onb.step', { n: step })}</p>
        <h1 className="m-0 mt-1 text-[28px] font-bold leading-tight">{titles[step]}</h1>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>
      </header>

      {step === 1 && (
        <Card>
          <CardTitle>{t('onb.consentsTitle')}</CardTitle>
          <CardDescription>{t('onb.consentsText')}</CardDescription>
          <div className="grid gap-1">
            {(['health', 'privacy', 'trainer'] as ConsentKind[]).map((k) => (
              <label key={k} htmlFor={`c-${k}`} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                <Checkbox id={`c-${k}`} className="mt-0.5" checked={agree[k]} onCheckedChange={(v) => setAgree((a) => ({ ...a, [k]: v === true }))} />
                <span className="text-[15px] leading-snug">{t(`onb.${k}`)}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <FieldGroup label={t('onb.sex')}>
            <SingleToggle value={d.sex} onChange={(v) => set('sex', v)} options={[{ value: 'm', label: t('onb.male') }, { value: 'f', label: t('onb.female') }]} />
          </FieldGroup>
          <FieldGroup label={t('onb.birth')}>
            <DatePicker
              aria-label={t('onb.birth')}
              title={t('onb.birth')}
              value={d.birth}
              onChange={(v) => set('birth', v)}
              lang={i18n.language}
              placeholder={t('onb.pickDate')}
              doneLabel={t('onb.done')}
              max={today()}
            />
          </FieldGroup>
          <Field label={t('onb.height')} inputMode="decimal" value={d.h} onChange={(e) => set('h', e.target.value)} />
          <Field label={t('onb.weight')} inputMode="decimal" value={d.w} onChange={(e) => set('w', e.target.value)} />
        </Card>
      )}

      {step === 3 && (
        <>
          <Card>
            <FieldGroup label={t('onb.activity')}>
              <SingleToggle
                variant="chip"
                value={d.act}
                onChange={(v) => set('act', v)}
                options={(['low', 'light', 'mid', 'high'] as const).map((a) => ({ value: a, label: t(`onb.act_${a}`) }))}
              />
            </FieldGroup>
            <FieldGroup label={t('onb.goal')}>
              <SingleToggle value={d.goal} onChange={(v) => set('goal', v)} options={(['lose', 'keep', 'gain'] as const).map((g) => ({ value: g, label: t(`onb.goal_${g}`) }))} />
            </FieldGroup>
            <Field label={t('onb.targetWeight')} inputMode="decimal" value={d.tw} onChange={(e) => set('tw', e.target.value)} />
          </Card>
          {preview && (
            <Card>
              <CardTitle>{t('onb.yourTarget')}</CardTitle>
              <Tiles>
                <Tile label={t('today.kcal')} value={preview.kcal} tone="orange" />
                <Tile label={t('today.protein')} value={`${preview.p} ${t('food.g')}`} tone="teal" />
              </Tiles>
              <CardDescription>{t('onb.targetNote')}</CardDescription>
            </Card>
          )}
        </>
      )}

      <div className="flex justify-end gap-3">
        {step > 1 && (
          <Button variant="secondary" className="min-w-[120px]" onClick={() => setStep(step - 1)}>
            {t('onb.back')}
          </Button>
        )}
        {step < 3 ? (
          <Button className="min-w-[120px]" disabled={step === 1 ? !okConsents : !okAbout} onClick={() => setStep(step + 1)}>
            {t('onb.next')}
          </Button>
        ) : (
          <Button className="min-w-[120px]" disabled={!okAbout || save.isPending} onClick={() => save.mutate(profile())}>
            {t('onb.finish')}
          </Button>
        )}
      </div>
    </main>
  );
}
