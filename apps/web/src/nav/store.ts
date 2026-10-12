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
