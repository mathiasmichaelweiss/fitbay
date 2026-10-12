import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { CalendarSheet } from '@/screens/CalendarSheet';
import { ProfileSheet } from '@/screens/ProfileSheet';
import { SettingsSheet } from '@/screens/SettingsSheet';
import { Tile, Tiles } from '@/components/ui/tile';
import { SingleToggle } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { today, useProfile } from '@/data/hooks';
import { Today } from '@/screens/Today';
import { Train } from '@/screens/train/Train';
import { WoBar } from '@/screens/train/WorkoutSheet';
import { useNav, type CabView, type Mode } from './store';

/** Иконки .top и NAVI прототипа (svg дословно). */
const sv = (d: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const NAVI: Record<Mode, ReactNode> = {
  clients: sv(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.3.2 4 1.8 4.5 4.5" /></>),
  food: sv(<><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" /><path d="M17 21V3c-2.5 1.5-4 4-4 8h4" /></>),
  train: sv(<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" />),
};
const ICON = {
  bell: sv(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></>),
  cal: sv(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  prof: sv(<><path d="M3 15.5V8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v6.5H3z" /><path d="M7 15.5v-3M11 15.5v-2M15 15.5v-3M19 15.5v-2" /></>),
  set: sv(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
};

/** .topic button прототипа: круг 44 px, фон плитки. */
function TopBtn({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-11 place-items-center rounded-full bg-card text-[#ddd] active:scale-[0.94]">
      {children}
    </button>
  );
}

/** #modeSw прототипа: активная пилюля растягивается и показывает подпись. */
function ModeSw({ tabs, mode, onChange }: { tabs: [Mode, string][]; mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useTranslation();
  return (
    <nav data-testid="modesw" className="mb-3 flex items-center gap-2">
      {tabs.map(([k, l]) => {
        const on = k === mode;
        return (
          <button
            key={k}
            type="button"
            aria-label={t(l)}
            aria-pressed={on}
            onClick={() => !on && onChange(k)}
            className={cn(
              'flex h-12 min-w-14 basis-14 shrink grow-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[#1c1c1c] px-3.5 text-[0.95rem] text-[#bbb] transition-[flex-grow,background-color,color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] active:scale-[0.96] motion-reduce:transition-none',
              on && 'grow bg-brand-cream font-semibold text-[#111]',
            )}
          >
            {NAVI[k]}
            <span
              className={cn(
                'inline-block -ml-2 max-w-0 -translate-x-1.5 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none',
                on && 'ml-0 max-w-[140px] translate-x-0 opacity-100',
              )}
            >
              {t(l)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function Shell() {
  const { t, i18n } = useTranslation();
  const { mode, cabView, isTrainer, setMode, setCabView } = useNav();
  const [day, setDay] = useState(today());
  const [cal, setCal] = useState(false);
  const [prof, setProf] = useState(false);
  const [settings, setSettings] = useState(false);
  const { data: profile } = useProfile();
  const setOnboarding = useNav((s) => s.setOnboarding);
  const m: Mode = mode === 'clients' && !isTrainer ? 'food' : mode;
  const locale = i18n.language === 'de' ? de : ru;
  const dayLabel = day === today() ? t('Сегодня') : format(parseISO(day), 'd MMMM', { locale });
  const tabs: [Mode, string][] = [...(isTrainer ? [['clients', 'Клиенты'] as [Mode, string]] : []), ['food', 'Питание'], ['train', 'Тренировки']];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] px-[14px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[14px]">
      <WoBar />
      {/* .top прототипа */}
      <header className="mx-1 mb-3.5 mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="date"
          onClick={() => setCal(true)}
          className={cn('h-9 rounded-full bg-card px-3.5 text-[0.9rem]', m !== 'food' && 'invisible')}
        >
          {dayLabel}
        </button>
        <div className="flex gap-2">
          <TopBtn label={t('Уведомления')}>{ICON.bell}</TopBtn>
          <TopBtn label={t('Календарь')} onClick={() => setCal(true)}>{ICON.cal}</TopBtn>
          <TopBtn label={t('Тело и цели')} onClick={() => setProf(true)}>{ICON.prof}</TopBtn>
          <TopBtn label={t('Настройки')} onClick={() => setSettings(true)}>{ICON.set}</TopBtn>
        </div>
      </header>

      <ModeSw tabs={tabs} mode={m} onChange={setMode} />

      <main>
        {m === 'food' ? (
          <Today date={day} />
        ) : m === 'train' ? (
          <Train />
        ) : (
          <div data-testid="clients">
            <div className="mb-3">
              <SingleToggle<CabView>
                value={cabView}
                onChange={setCabView}
                options={[
                  { value: 'list', label: t('Клиенты') },
                  { value: 'sched', label: t('Расписание') },
                  { value: 'fin', label: t('Обзор') },
                ]}
              />
            </div>
            <Tiles>
              <Tile full color="dark" label={t(cabView === 'list' ? 'Клиенты' : cabView === 'sched' ? 'Расписание' : 'Обзор')} title={t('Скоро здесь будет раздел')} />
            </Tiles>
          </div>
        )}
      </main>

      <CalendarSheet open={cal} day={day} onPick={(d) => (setDay(d), setMode('food'))} onClose={() => setCal(false)} />
      {profile && <ProfileSheet open={prof} profile={profile} onClose={() => setProf(false)} />}
      <SettingsSheet open={settings} onClose={() => setSettings(false)} onOnboarding={() => setOnboarding(true)} />
    </div>
  );
}
