import { create } from 'zustand';

export type ClientTab = 'today' | 'workouts' | 'progress' | 'trainer';
export type CabinetTab = 'clients' | 'schedule' | 'overview' | 'templates';
export type Mode = 'me' | 'cabinet';

interface NavState {
  mode: Mode;
  tab: ClientTab;
  cabinetTab: CabinetTab;
  isTrainer: boolean; // заглушка до Auth0 (A2.2): роль придёт из JWT
  setMode: (m: Mode) => void;
  setTab: (t: ClientTab) => void;
  setCabinetTab: (t: CabinetTab) => void;
  setTrainer: (v: boolean) => void;
}

export const useNav = create<NavState>((set) => ({
  mode: 'me',
  tab: 'today',
  cabinetTab: 'clients',
  isTrainer: false,
  setMode: (mode) => set({ mode }),
  setTab: (tab) => set({ tab }),
  setCabinetTab: (cabinetTab) => set({ cabinetTab }),
  setTrainer: (isTrainer) => set({ isTrainer, mode: isTrainer ? 'me' : 'me' }),
}));
