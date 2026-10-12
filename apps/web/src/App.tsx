import { useEffect, useState } from 'react';
import { Showcase } from './Showcase';

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
  if (hash === '#/ui') return <Showcase />;
  return (
    <main className="page">
      <h1 style={{ color: 'var(--orange)', margin: 0 }}>FitBay</h1>
      <p>
        Витрина компонентов: <a href="#/ui" style={{ color: 'var(--teal)' }}>#/ui</a>
      </p>
    </main>
  );
}
