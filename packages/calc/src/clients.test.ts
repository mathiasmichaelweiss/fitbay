import { describe, expect, it } from 'vitest';
import g from './golden-clients.json';
import { clPatterns, clStats, mealFlag, type ClSnap } from './clients';

// Эталоны: clStats, clPatterns, mealFlag прототипа (scripts/golden-clients.mjs).
describe('кабинет тренера = прототип', () => {
  for (const lang of ['ru', 'de'] as const)
    it.each(g[lang].map((x) => [x.c.name, x] as const))(`${lang}: %s`, (_, x) => {
      expect(clStats(x.c as ClSnap, g.today)).toEqual(x.stats);
      expect(clPatterns(x.c as ClSnap, g.today, lang)).toEqual(x.pat);
    });
  it.each(g.flags.map((x, i) => [i, x] as const))('mealFlag #%d', (_, x) => expect(mealFlag(x.i, x.t)).toEqual(x.v));
});
