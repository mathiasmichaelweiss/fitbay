import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { de, ru } from 'date-fns/locale';
import { BellIcon, RulerIcon, CalendarDaysIcon, DumbbellIcon, EuroIcon, LayoutTemplateIcon, PaletteIcon, SettingsIcon, SunIcon, TrendingUpIcon, UserRoundIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarSheet } from '@/screens/CalendarSheet';
import { ProfileSheet } from '@/screens/ProfileSheet';
import { SettingsSheet } from '@/screens/SettingsSheet';
import { Tile, Tiles } from '@/components/ui/tile';
import { SingleToggle } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { today, useProfile } from '@/data/hooks';
import { Today } from '@/screens/Today';
import { Progress } from '@/screens/Progress';
import { useNav, type CabinetTab, type ClientTab } from './store';

/** Нижняя навигация по спеке, раздел 6 (4 раздела клиента, «Я / Кабинет» у тренера). */
const CLIENT_TABS: { id: ClientTab; icon: LucideIcon; label: string }[] = [
  { id: 'today', icon: SunIcon, label: 'Сегодня' },
  { id: 'workouts', icon: DumbbellIcon, label: 'Тренировки' },
  { id: 'progress', icon: TrendingUpIcon, label: 'Прогресс' },
  { id: 'trainer', icon: UserRoundIcon, label: 'Тренер' },
];
const CABINET_TABS: { id: CabinetTab; icon: LucideIcon; label: string }[] = [
  { id: 'clients', icon: UsersIcon, label: 'Клиенты' },
  { id: 'schedule', icon: CalendarDaysIcon, label: 'Расписание' },
  { id: 'overview', icon: EuroIcon, label: 'Обзор' },
  { id: 'templates', icon: LayoutTemplateIcon, label: 'Шаблоны' },
];
const TITLE: Record<ClientTab | CabinetTab, string> = Object.fromEntries([...CLIENT_TABS, ...CABINET_TABS].map((x) => [x.id, x.label])) as never;

export function Shell() {
  const { t, i18n } = useTranslation();
  const { mode, tab, cabinetTab, isTrainer, setMode, setTab, setCabinetTab } = useNav();
  const [day, setDay] = useState(today());
  const [cal, setCal] = useState(false);
  const [prof, setProf] = useState(false);
  const [settings, setSettings] = useState(false);
  const { data: profile } = useProfile();
  const setOnboarding = useNav((s) => s.setOnboarding);
  const inCabinet = isTrainer && mode === 'cabinet';
  const active = inCabinet ? cabinetTab : tab;
  const locale = i18n.language === 'de' ? de : ru;
  const dayLabel = day === today() ? t('Сегодня') : format(parseISO(day), 'd MMMM', { locale });

  return (
    <div className="flex min-h-dvh flex-col">
      {/* .top прототипа: дата слева, круглые иконки справа */}
      <header className="sticky top-0 z-20 mx-auto flex w-full max-w-[520px] items-center justify-between gap-2 bg-background px-[18px] pb-3 pt-[18px]">
        {!inCabinet && tab === 'today' ? (
          <button type="button" data-testid="title" onClick={() => setCal(true)} className="h-9 rounded-full bg-card px-3.5 text-[0.9rem]">
            {dayLabel}
          </button>
        ) : (
          <h1 data-testid="title" className="m-0 text-[1.3rem] font-bold tracking-[-0.02em]">
            {t(TITLE[active])}
          </h1>
        )}
        <div className="flex gap-2">
          {import.meta.env.DEV && (
            <Button variant="tile" size="icon" asChild>
              <a href="/ui" aria-label="UI kit" title="Библиотека компонентов">
                <PaletteIcon className="size-5" />
              </a>
            </Button>
          )}
          <Button variant="tile" size="icon" aria-label={t('Уведомления')}>
            <BellIcon className="size-5" />
          </Button>
          <Button variant="tile" size="icon" aria-label={t('Тело и цели')} onClick={() => setProf(true)}>
            <RulerIcon className="size-5" />
          </Button>
          <Button variant="tile" size="icon" aria-label={t('Настройки')} onClick={() => setSettings(true)}>
            <SettingsIcon className="size-5" />
          </Button>
        </div>
      </header>

      {isTrainer && (
        <div className="mx-auto w-full max-w-[520px] px-[14px] pb-3">
          <SingleToggle value={mode} onChange={setMode} options={[{ value: 'me', label: t('Я') }, { value: 'cabinet', label: t('Кабинет') }]} />
        </div>
      )}

      <main className="mx-auto w-full max-w-[520px] flex-1 px-[14px] pb-[calc(96px+env(safe-area-inset-bottom))]">
        {!inCabinet && tab === 'today' ? (
          <Today date={day} />
        ) : !inCabinet && tab === 'progress' ? (
          <Progress />
        ) : (
          <Tiles>
            <Tile full color="dark" label={t(TITLE[active])} title={t('Скоро здесь будет раздел')} />
          </Tiles>
        )}
      </main>

      <nav data-testid="tabbar" className="fixed inset-x-0 bottom-0 z-20 border-t border-[#1c1c1c] bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-[520px] grid-cols-4">
          {(inCabinet ? CABINET_TABS : CLIENT_TABS).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              aria-current={active === id ? 'page' : undefined}
              onClick={() => (inCabinet ? setCabinetTab(id as CabinetTab) : setTab(id as ClientTab))}
              className={cn('grid min-h-[60px] place-items-center gap-0.5 py-1.5 text-xs font-semibold text-muted-foreground', active === id && 'text-foreground')}
            >
              <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', active === id && 'bg-brand-cream text-on-color')}>
                <Icon className="size-5" aria-hidden />
              </span>
              {t(label)}
            </button>
          ))}
        </div>
      </nav>

      <CalendarSheet open={cal} day={day} onPick={setDay} onClose={() => setCal(false)} />
      {profile && <ProfileSheet open={prof} profile={profile} onClose={() => setProf(false)} />}
      <SettingsSheet open={settings} onClose={() => setSettings(false)} onOnboarding={() => setOnboarding(true)} />
    </div>
  );
}
