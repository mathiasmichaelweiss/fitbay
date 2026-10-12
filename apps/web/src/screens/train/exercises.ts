import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Exercise, ExLang } from '@fitbay/shared/exercises';
import { api } from '@/data/api';

/** База упражнений (≈0,7 МБ) и картинки грузятся отдельным чанком при первом открытии «Тренировок». */
const load = async () => {
  const [m, img] = await Promise.all([import('@fitbay/shared/exercises'), import('@/data/exercises/eximg.json')]);
  return { ...m, EXIMG: img.default as Record<string, string> };
};
export type ExData = Awaited<ReturnType<typeof load>>;
type Names = { map: Record<string, string>; left: number; total: number };

const fetchNames = (lang: string, translate: boolean) => api.call<Names>('POST', '/ai/ex_names', { lang, translate });

export function useEx() {
  const { i18n } = useTranslation();
  const q = useQuery({ queryKey: ['exdb'], queryFn: load, staleTime: Infinity, gcTime: Infinity });
  const lang = (i18n.language === 'de' ? 'de' : 'ru') as ExLang;
  // переведенные названия из общего кэша (tr-names прототипа)
  const nq = useQuery({ queryKey: ['exnames', lang], queryFn: () => fetchNames(lang, false), staleTime: Infinity, retry: false });
  const names = nq.data?.map ?? {};
  const db = q.data;
  return {
    db,
    lang,
    left: nq.data?.left ?? 0,
    /** exName() прототипа */
    name: (id: string | Exercise | undefined) => {
      if (!db || !id) return '';
      const e = typeof id === 'string' ? db.EXM[id] : id;
      return e ? db.exName(e, lang, names) : String(id);
    },
    /** D() прототипа */
    d: (k: string) => (db ? db.D(k, lang) : k),
  };
}

/**
 * translateNames() прототипа: пока библиотека открыта, переводит недостающие названия порциями по 120
 * и показывает прогресс. Возвращает процент или null, если переводить нечего.
 */
export function useTranslateNames(active: boolean): number | null {
  const { lang, left } = useEx();
  const qc = useQueryClient();
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !left) return;
    let stop = false;
    void (async () => {
      try {
        for (let k = 0; k < 10 && !stop; k++) {
          const r = await fetchNames(lang, true);
          qc.setQueryData(['exnames', lang], r);
          setPct(Math.round((100 * (r.total - r.left)) / r.total));
          if (!r.left) break;
        }
      } catch {
        /* как в прототипе: молча */
      }
      setPct(null);
    })();
    return () => {
      stop = true;
    };
    // запускаем один раз на открытие
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lang]);
  return pct;
}

/** Техника на языке интерфейса (openEx прототипа): из общего кэша или перевод. */
export function useExSteps(id: string | null) {
  const { lang } = useEx();
  return useQuery({
    queryKey: ['exsteps', lang, id],
    enabled: !!id,
    staleTime: Infinity,
    retry: false,
    queryFn: () => api.call<{ t: string[] }>('POST', '/ai/ex_steps', { lang, id }).then((r) => r.t),
  });
}
