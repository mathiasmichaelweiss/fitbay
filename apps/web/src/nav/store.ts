import { create } from 'zustand';

/** Режимы #modeSw прототипа: clients только у тренера. */
export type Mode = 'clients' | 'food' | 'train';
/** cabSw прототипа: Клиенты / Расписание / Обзор. */
export type CabView = 'list' | 'sched' | 'fin';

interface NavState {
  mode: Mode;
  cabView: CabView;
  isTrainer: boolean; // заглушка до Auth0 (A2.2): роль придет из JWT
  /** «Пройти знакомство заново» из настроек */
  onboarding: boolean;
  /** открыт лист «Тело и цели»; msFocus: прокрутить к замерам (msRemind прототипа) */
  prof: false | 'top' | 'ms';
  setProf: (v: false | 'top' | 'ms') => void;
  /** листы тренера (A3.6) и колокольчик (A3.7) */
  catalog: boolean;
  trainer: string | null;
  share: string | null | true;
  tips: 'food' | 'train' | null;
  bell: boolean;
  open: (p: Partial<Pick<NavState, 'catalog' | 'trainer' | 'share' | 'tips' | 'bell'>>) => void;
  setOnboarding: (v: boolean) => void;
  setMode: (m: Mode) => void;
  setCabView: (v: CabView) => void;
  setTrainer: (v: boolean) => void;
}

const saved = (): Mode => {
  try {
    const m = localStorage.getItem('mode');
    if (m === 'food' || m === 'train' || m === 'clients') return m;
  } catch {
    /* нет хранилища */
  }
  return 'food';
};

export const useNav = create<NavState>((set, get) => ({
  mode: saved(),
  cabView: 'list',
  isTrainer: false,
  onboarding: false,
  prof: false,
  setProf: (prof) => set({ prof }),
  catalog: false,
  trainer: null,
  share: null,
  tips: null,
  bell: false,
  open: (p) => set(p),
  setOnboarding: (onboarding) => set({ onboarding }),
  // как setMode прототипа: clients без тренера превращается в food
  setMode: (m) => {
    const mode = m === 'clients' && !get().isTrainer ? 'food' : m;
    try {
      localStorage.setItem('mode', mode);
    } catch {
      /* нет хранилища */
    }
    set({ mode });
  },
  setCabView: (cabView) => set({ cabView }),
  setTrainer: (isTrainer) => set((s) => ({ isTrainer, mode: !isTrainer && s.mode === 'clients' ? 'food' : s.mode })),
}));
