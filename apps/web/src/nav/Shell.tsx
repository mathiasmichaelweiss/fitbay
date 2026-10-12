import { useTranslation } from 'react-i18next';
import { Card, Seg, Tile } from '../ui';
import { LANGS } from '../i18n';
import { useNav, type CabinetTab, type ClientTab } from './store';
import './nav.css';

const CLIENT_TABS: { id: ClientTab; icon: string }[] = [
  { id: 'today', icon: '◎' },
  { id: 'workouts', icon: '▲' },
  { id: 'progress', icon: '↗' },
  { id: 'trainer', icon: '☺' },
];
const CABINET_TABS: { id: CabinetTab; icon: string }[] = [
  { id: 'clients', icon: '☺' },
  { id: 'schedule', icon: '▦' },
  { id: 'overview', icon: '€' },
  { id: 'templates', icon: '❐' },
];

// Плитки-заглушки разделов по спеке, раздел 6. Наполняются в A3.x и A4.x.
const SECTIONS: Record<ClientTab | CabinetTab, string[]> = {
  today: ['today.kcal', 'today.protein', 'today.addFood', 'today.wellbeing', 'today.coach', 'today.nextWorkout'],
  workouts: ['workouts.start', 'workouts.programs', 'workouts.history', 'workouts.trainerPlan'],
  progress: ['progress.weight', 'progress.measures', 'progress.beforeAfter', 'progress.route'],
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
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__title">{t(titleKey)}</h1>
        <button type="button" className="langbtn" aria-label={t('header.language')} onClick={() => void i18n.changeLanguage(nextLang)}>
          {i18n.language}
        </button>
        <button type="button" className="iconbtn" aria-label={t('header.notifications')}>🔔</button>
        <button type="button" className="iconbtn" aria-label={t('header.settings')}>⚙</button>
      </header>

      {isTrainer && (
        <div className="modebar">
          <Seg value={mode} onChange={setMode} options={[{ value: 'me', label: t('nav.me') }, { value: 'cabinet', label: t('nav.cabinet') }]} />
        </div>
      )}

      <main className="shell__main page">
        {SECTIONS[active].length > 0 ? (
          <div className="tiles">
            {SECTIONS[active].map((k) => (
              <Tile key={k} label={t(k)} value="…" />
            ))}
          </div>
        ) : (
          <Card>
            <p style={{ margin: 0, color: 'var(--muted)' }}>{t('common.soon')}</p>
          </Card>
        )}
      </main>

      <nav className="tabbar">
        {(inCabinet ? CABINET_TABS : CLIENT_TABS).map((x) => (
          <button
            key={x.id}
            type="button"
            className="tabbar__item"
            aria-current={active === x.id ? 'page' : undefined}
            onClick={() => (inCabinet ? setCabinetTab(x.id as CabinetTab) : setTab(x.id as ClientTab))}
          >
            <span className="tabbar__icon" aria-hidden>{x.icon}</span>
            {t(inCabinet ? `cabinet.${x.id}` : `nav.${x.id}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
