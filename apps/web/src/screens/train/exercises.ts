import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Exercise, ExLang } from '@fitbay/shared/exercises';

/** База упражнений (≈0,7 МБ) и картинки грузятся отдельным чанком при первом открытии «Тренировок». */
const load = async () => {
  const [m, img] = await Promise.all([import('@fitbay/shared/exercises'), import('@/data/exercises/eximg.json')]);
  return { ...m, EXIMG: img.default as Record<string, string> };
};
export type ExData = Awaited<ReturnType<typeof load>>;

export function useEx() {
  const { i18n } = useTranslation();
  const q = useQuery({ queryKey: ['exdb'], queryFn: load, staleTime: Infinity, gcTime: Infinity });
  const lang = (i18n.language === 'de' ? 'de' : 'ru') as ExLang;
  const db = q.data;
  return {
    db,
    lang,
    /** exName() прототипа */
    name: (id: string | Exercise | undefined) => {
      if (!db || !id) return '';
      const e = typeof id === 'string' ? db.EXM[id] : id;
      return e ? db.exName(e, lang) : String(id);
    },
    /** D() прототипа */
    d: (k: string) => (db ? db.D(k, lang) : k),
  };
}
