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
  onb: {
    welcome: 'Willkommen bei FitBay',
    step: 'Schritt {{n}} von 3',
    consentsTitle: 'Einwilligungen',
    consentsText: 'FitBay speichert Daten zu Ernährung, Gewicht und Befinden. Das sind Gesundheitsdaten, deshalb brauchen wir deine ausdrückliche Einwilligung.',
    health: 'Ich willige in die Verarbeitung meiner Gesundheitsdaten für die Nutzung der App ein',
    privacy: 'Ich habe die Datenschutzerklärung gelesen',
    trainer: 'Meinem Trainer Zugriff auf meine Daten geben (später möglich)',
    aboutTitle: 'Über dich',
    sex: 'Geschlecht', male: 'Männlich', female: 'Weiblich',
    birth: 'Geburtsdatum', height: 'Größe, cm', weight: 'Gewicht, kg',
    goalTitle: 'Ziel',
    activity: 'Aktivität',
    act_low: 'Sitzend', act_light: 'Leicht', act_mid: 'Mittel', act_high: 'Hoch',
    goal: 'Ziel', goal_lose: 'Abnehmen', goal_keep: 'Form halten', goal_gain: 'Zunehmen',
    targetWeight: 'Zielgewicht, kg (optional)',
    yourTarget: 'Dein Tagesbedarf',
    targetNote: 'Berechnet nach Mifflin. Später kann dein Trainer den Bedarf anpassen.',
    next: 'Weiter', back: 'Zurück', finish: 'Los geht’s',
  },
  common: { soon: 'Dieser Bereich kommt bald' },
};
