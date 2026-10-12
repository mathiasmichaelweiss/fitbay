import { ConfirmHost } from '@/components/ui/confirm';
import { useEffect, useState } from 'react';
import { Showcase } from './Showcase';
import { Shell } from './nav/Shell';
import { useNav } from './nav/store';
import { Onboarding } from './screens/Onboarding';
import { useProfile } from './data/hooks';

const where = () => location.pathname + location.hash;

const useLocation = () => {
  const [loc, setLoc] = useState(where());
  useEffect(() => {
    const on = () => setLoc(where());
    addEventListener('hashchange', on);
    addEventListener('popstate', on);
    return () => {
      removeEventListener('hashchange', on);
      removeEventListener('popstate', on);
    };
  }, []);
  return loc;
};

/** Библиотека компонентов: /ui (и старый адрес #/ui). */
export const isShowcase = (loc: string) => loc.startsWith('/ui') || loc.endsWith('#/ui');

export function App() {
  const loc = useLocation();
  const setTrainer = useNav((s) => s.setTrainer);
  const again = useNav((s) => s.onboarding);
  // До Auth0: #/trainer включает роль тренера для проверки «Я / Кабинет».
  useEffect(() => setTrainer(loc.endsWith('#/trainer')), [loc, setTrainer]);
  const { data: profile, isLoading } = useProfile();
  if (isShowcase(loc))
    return (
      <>
        <Showcase />
        <ConfirmHost />
      </>
    );
  if (isLoading) return null;
  // Без профиля или без обязательных согласий приложение не открываем (DSGVO, спека 7).
  // Как в прототипе: без профиля или без согласия на данные о здоровье (ст. 9 DSGVO) открывается онбординг.
  if (!profile || !profile.consents?.health || again) return <Onboarding initial={profile} />;
  return (
    <>
      <Shell />
      <ConfirmHost />
    </>
  );
}
