import { useEffect, useState } from 'react';
import { Showcase } from './Showcase';
import { Shell } from './nav/Shell';
import { useNav } from './nav/store';

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
  // До Auth0: #/trainer включает роль тренера для проверки «Я / Кабинет».
  useEffect(() => setTrainer(loc.endsWith('#/trainer')), [loc, setTrainer]);
  if (isShowcase(loc)) return <Showcase />;
  return <Shell />;
}
