import { useTranslation } from 'react-i18next';
import { BellIcon, CalendarDaysIcon, DumbbellIcon, EuroIcon, LayoutTemplateIcon, PaletteIcon, SettingsIcon, SunIcon, TrendingUpIcon, UserRoundIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tile, Tiles } from '@/components/ui/tile';
import { SingleToggle } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { LANGS } from '@/i18n';
import { Today } from '@/screens/Today';
import { Progress } from '@/screens/Progress';
import { useNav, type CabinetTab, type ClientTab } from './store';

const CLIENT_TABS: { id: ClientTab; icon: LucideIcon }[] = [
  { id: 'today', icon: SunIcon },
  { id: 'workouts', icon: DumbbellIcon },
  { id: 'progress', icon: TrendingUpIcon },
  { id: 'trainer', icon: UserRoundIcon },
];
const CABINET_TABS: { id: CabinetTab; icon: LucideIcon }[] = [
  { id: 'clients', icon: UsersIcon },
  { id: 'schedule', icon: CalendarDaysIcon },
  { id: 'overview', icon: EuroIcon },
  { id: 'templates', icon: LayoutTemplateIcon },
];

// Плитки-заглушки разделов по спеке, раздел 6. Наполняются в A3.x и A4.x.
const SECTIONS: Record<ClientTab | CabinetTab, string[]> = {
  today: [], progress: [],
  workouts: ['workouts.start', 'workouts.programs', 'workouts.history', 'workouts.trainerPlan'],
  trainer: ['trainer.mine', 'trainer.book', 'trainer.packages', 'trainer.catalog'],
  clients: [], schedule: [], overview: [], templates: [],
};

export function Shell() {
  const { t, i18n } = useTranslation();
  const { mode, tab, cabinetTab, isTrainer, setMode, setTab, setCabinetTab } = useNav();
  const inCabinet = isTrainer && mode === 'cabinet';
  const active = inCabinet ? cabinetTab : tab;
  const titleKey = inCabinet ? `cabinet.${cabinetTab}` : `nav.${tab}`;
  const nextLang = LANGS[(LANGS.indexOf(i18n.language as never) + 1) % LANGS.length]!;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b bg-background/90 px-4 py-2 backdrop-blur">
        <h1 data-testid="title" className="m-0 flex-1 text-xl font-bold">
          {t(titleKey)}
        </h1>
        <Button variant="outline" size="sm" className="h-11 uppercase" aria-label={t('header.language')} onClick={() => void i18n.changeLanguage(nextLang)}>
          {i18n.language}
        </Button>
        {import.meta.env.DEV && (
          <Button variant="ghost" size="icon" asChild>
            <a href="/ui" aria-label="UI kit" title="Библиотека компонентов">
              <PaletteIcon className="size-5" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={t('header.notifications')}>
          <BellIcon className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t('header.settings')}>
          <SettingsIcon className="size-5" />
        </Button>
      </header>

      {isTrainer && (
        <div className="px-4 pt-2">
          <SingleToggle value={mode} onChange={setMode} options={[{ value: 'me', label: t('nav.me') }, { value: 'cabinet', label: t('nav.cabinet') }]} />
        </div>
      )}

      <main className="mx-auto w-full max-w-[480px] flex-1 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4">
        {!inCabinet && tab === 'today' ? (
          <Today />
        ) : !inCabinet && tab === 'progress' ? (
          <Progress />
        ) : SECTIONS[active].length > 0 ? (
          <Tiles>
            {SECTIONS[active].map((k) => (
              <Tile key={k} label={t(k)} value="…" />
            ))}
          </Tiles>
        ) : (
          <Card>
            <p className="m-0 text-muted-foreground">{t('common.soon')}</p>
          </Card>
        )}
      </main>

      <nav data-testid="tabbar" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        {(inCabinet ? CABINET_TABS : CLIENT_TABS).map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={active === id ? 'page' : undefined}
            onClick={() => (inCabinet ? setCabinetTab(id as CabinetTab) : setTab(id as ClientTab))}
            className={cn('grid min-h-[60px] place-items-center gap-0.5 py-1.5 text-xs font-semibold text-muted-foreground', active === id && 'text-brand-orange')}
          >
            <Icon className="size-5" aria-hidden />
            {t(inCabinet ? `cabinet.${id}` : `nav.${id}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
