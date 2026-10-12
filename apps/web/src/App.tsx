import { useEffect, useState } from 'react';
import { Showcase } from './Showcase';
import { Shell } from './nav/Shell';
import { useNav } from './nav/store';

const useHash = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export function App() {
  const hash = useHash();
  const setTrainer = useNav((s) => s.setTrainer);
  // До Auth0: #/trainer включает роль тренера для проверки «Я / Кабинет».
  useEffect(() => setTrainer(hash === '#/trainer'), [hash, setTrainer]);
  if (hash === '#/ui') return <Showcase />;
  return <Shell />;
}
