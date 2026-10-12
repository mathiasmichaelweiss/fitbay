import type { Dict } from './ru';

// Стартовый перевод. Заменить строками из словаря DE прототипа (A0.3, после получения kalorii.html).
export const de: Dict = {
  app: { name: 'FitBay' },
  nav: { today: 'Heute', workouts: 'Training', progress: 'Fortschritt', trainer: 'Trainer', me: 'Ich', cabinet: 'Cockpit' },
  header: { settings: 'Einstellungen', notifications: 'Benachrichtigungen', language: 'Sprache' },
  today: { kcal: 'Kalorien', protein: 'Eiweiß', addFood: 'Essen hinzufügen', wellbeing: 'Befinden', coach: 'Coach-Tipp', nextWorkout: 'Nächstes Training' },
  workouts: { start: 'Training starten', programs: 'Meine Programme', history: 'Verlauf', trainerPlan: 'Plan vom Trainer' },
  progress: { weight: 'Gewicht', measures: 'Körpermaße', beforeAfter: 'Vorher/Nachher', route: 'Planverlauf' },
  trainer: { mine: 'Mein Trainer', book: 'Termin buchen', packages: 'Pakete', catalog: 'Trainer finden' },
  cabinet: { clients: 'Kunden', schedule: 'Kalender', overview: 'Übersicht', templates: 'Vorlagen' },
  common: { soon: 'Dieser Bereich kommt bald' },
};
