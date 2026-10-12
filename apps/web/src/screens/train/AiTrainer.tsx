import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SingleToggle, ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api, ApiError } from '@/data/api';
import { today, useProfile, useProgramOps } from '@/data/hooks';
import { useEx } from './exercises';
import { useTrain } from './store';

type Place = 'gym' | 'street' | 'home';
type Res = { days: { name: string; items: { id: string; sets: number; reps: string }[] }[]; note: string };

/** sh-ai прототипа: где, уровень, дней в неделю, инвентарь дома, пожелания. Программа сохраняется днями в «Мои программы». */
export function AiTrainer() {
  const { t, i18n } = useTranslation();
  const { ai, set } = useTrain();
  const { data: profile } = useProfile();
  const { create } = useProgramOps();
  const { db, name } = useEx();
  const [place, setPlace] = useState<Place>('gym');
  const [lvl, setLvl] = useState('beginner');
  const [days, setDays] = useState(3);
  const [eq, setEq] = useState<string[]>(['none']);
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Res | null>(null);

  // как в прототипе: при открытии дни из тренировок в неделю профиля
  useEffect(() => {
    if (!ai) return;
    const a = +(profile?.act ?? 3);
    setDays(a >= 5 ? 5 : a >= 3 ? 3 : 2);
  }, [ai, profile?.act]);

  // aiEq: «Ничего» сбрасывает остальное, пустой выбор возвращает «Ничего»
  const pickEq = (v: string[]) => {
    const added = v.find((k) => !eq.includes(k));
    if (added === 'none') return setEq(['none']);
    const n = v.filter((k) => k !== 'none');
    setEq(n.length ? n : ['none']);
  };

  const go = async () => {
    setErr('');
    setBusy(true);
    try {
      const r = await api.call<{ result: Res }>('POST', '/ai/workout_ai', { place, lvl, days, eq, wish: wish.trim(), lang: i18n.language, day: today() });
      setRes(r.result);
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? e.message : t('Не получилось составить программу, попробуй еще раз.'));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!res) return;
    const now = Date.now();
    try {
      await Promise.all(res.days.map((d, k) => create.mutateAsync({ date: today(), name: d.name, items: d.items, src: 'ai', at: now + k })));
      setRes(null);
      set({ ai: false, prog: true, progEmpty: false });
    } catch {
      /* как в прототипе: молча */
    }
  };

  return (
    <SheetPage open={ai} onOpenChange={(o) => !o && set({ ai: false })} title={t('AI-тренер')}>
      <Card className="gap-4">
        <FieldGroup label={t('Где тренируешься')}>
          <SingleToggle
            value={place}
            onChange={setPlace}
            options={[
              { value: 'gym', label: t('Зал') },
              { value: 'street', label: t('Улица (турник, брусья)') },
              { value: 'home', label: t('Дома') },
            ]}
          />
        </FieldGroup>
        <FieldGroup label={t('Уровень')}>
          <SingleToggle
            value={lvl}
            onChange={setLvl}
            options={[
              { value: 'beginner', label: t('Новичок') },
              { value: 'intermediate', label: t('Средний') },
              { value: 'expert', label: t('Продвинутый') },
            ]}
          />
        </FieldGroup>
        <FieldGroup label={t('Тренировок в неделю')}>
          <SingleToggle value={String(days)} onChange={(v) => setDays(+v)} options={['2', '3', '4', '5'].map((v) => ({ value: v, label: v }))} />
        </FieldGroup>
        {place === 'home' && db && (
          <FieldGroup label={t('Что есть дома')}>
            <ToggleGroup type="multiple" value={eq} onValueChange={pickEq}>
              {db.AI_EQ.map(([k, n]) => (
                <ToggleGroupItem key={k} value={k}>
                  {t(n)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldGroup>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="aiWish">{t('Пожелания (необязательно)')}</Label>
          <Textarea id="aiWish" value={wish} onChange={(e) => setWish(e.target.value)} placeholder={t('Например: хочу выход силой, болит колено, только 45 минут')} />
        </div>
      </Card>
      {err && (
        <div role="alert" className="mt-2 text-sm text-brand-orange">
          {err}
        </div>
      )}
      <Button className="mt-4 w-full" onClick={go} disabled={busy}>
        {t(busy ? 'Составляю программу...' : 'Составить программу')}
      </Button>
      {res && (
        <Card className="mt-3 gap-0" data-testid="ai-res">
          <p className="m-0 mb-2.5 text-[0.92rem]">{res.note}</p>
          {res.days.map((d) => (
            <div key={d.name} className="mb-3">
              <b>{d.name}</b>
              <div className="mt-1 text-[0.85rem] opacity-75">
                {d.items.map((i) => (
                  <div key={i.id}>
                    {name(i.id)} {i.sets}×{i.reps}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button className="mt-1.5 w-full" onClick={save}>
            {t('Сохранить в мои программы')}
          </Button>
        </Card>
      )}
    </SheetPage>
  );
}
