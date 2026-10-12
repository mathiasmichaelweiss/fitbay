import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { target } from '@fitbay/calc';
import { CONSENT_VERSIONS, type ConsentKind, type Profile } from '@fitbay/shared';
import { Button, Card, Field, Seg, Tile } from '../ui';
import { today, useSaveProfile } from '../data/hooks';
import './screens.css';

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

  return (
    <main className="page onb">
      <header>
        <p className="onb__step">{t('onb.step', { n: step })}</p>
        <h1 className="onb__title">{step === 1 ? t('onb.welcome') : step === 2 ? t('onb.aboutTitle') : t('onb.goalTitle')}</h1>
      </header>

      {step === 1 && (
        <Card title={t('onb.consentsTitle')}>
          <p className="muted">{t('onb.consentsText')}</p>
          {(['health', 'privacy', 'trainer'] as ConsentKind[]).map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={agree[k]} onChange={(e) => setAgree((a) => ({ ...a, [k]: e.target.checked }))} />
              <span>{t(`onb.${k}`)}</span>
            </label>
          ))}
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div className="stack">
            <div className="field">
              <span className="field__label">{t('onb.sex')}</span>
              <Seg value={d.sex} onChange={(v) => set('sex', v)} options={[{ value: 'm', label: t('onb.male') }, { value: 'f', label: t('onb.female') }]} />
            </div>
            <Field label={t('onb.birth')} type="date" value={d.birth} max={today()} onChange={(e) => set('birth', e.target.value)} />
            <Field label={t('onb.height')} inputMode="decimal" value={d.h} onChange={(e) => set('h', e.target.value)} />
            <Field label={t('onb.weight')} inputMode="decimal" value={d.w} onChange={(e) => set('w', e.target.value)} />
          </div>
        </Card>
      )}

      {step === 3 && (
        <>
          <Card>
            <div className="stack">
              <div className="field">
                <span className="field__label">{t('onb.activity')}</span>
                <div className="chips">
                  {(['low', 'light', 'mid', 'high'] as const).map((a) => (
                    <button key={a} type="button" className="chip" aria-pressed={d.act === a} onClick={() => set('act', a)}>
                      {t(`onb.act_${a}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field__label">{t('onb.goal')}</span>
                <Seg
                  value={d.goal}
                  onChange={(v) => set('goal', v)}
                  options={(['lose', 'keep', 'gain'] as const).map((g) => ({ value: g, label: t(`onb.goal_${g}`) }))}
                />
              </div>
              <Field label={t('onb.targetWeight')} inputMode="decimal" value={d.tw} onChange={(e) => set('tw', e.target.value)} />
            </div>
          </Card>
          {preview && (
            <Card title={t('onb.yourTarget')}>
              <div className="tiles">
                <Tile label={t('today.kcal')} value={preview.kcal} tone="orange" />
                <Tile label={t('today.protein')} value={`${preview.p} г`} tone="teal" />
              </div>
              <p className="muted small">{t('onb.targetNote')}</p>
            </Card>
          )}
        </>
      )}

      <div className="onb__actions">
        {step > 1 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            {t('onb.back')}
          </Button>
        )}
        {step < 3 ? (
          <Button disabled={step === 1 ? !okConsents : !okAbout} onClick={() => setStep(step + 1)}>
            {t('onb.next')}
          </Button>
        ) : (
          <Button disabled={!okAbout || save.isPending} onClick={() => save.mutate(profile())}>
            {t('onb.finish')}
          </Button>
        )}
      </div>
    </main>
  );
}
