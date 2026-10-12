import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import protoDe from './proto-de.json';
import { extraDe } from './extra-de';

const DE = { ...(protoDe as Record<string, string>), ...extraDe };
const SRC = path.resolve(__dirname, '..');

/** Все строковые литералы в вызовах t('...') по исходникам web. */
function usedKeys(): string[] {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f.name) && !f.name.endsWith('.test.ts')) files.push(p);
    }
  };
  walk(SRC);
  const keys = new Set<string>();
  const re = /\bt\(\s*(['"])((?:\\.|(?!\1).)+)\1/g;
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(re)) keys.add(m[2]!.replace(/\\'/g, "'"));
  return [...keys];
}

describe('словарь de', () => {
  it('словарь прототипа загружен', () => expect(Object.keys(protoDe).length).toBeGreaterThan(1000));
  it('каждая строка интерфейса есть в немецком словаре', () => {
    const missing = usedKeys().filter((k) => !(k in DE));
    expect(missing).toEqual([]);
  });
  it('строки de не пустые', () => expect(Object.values(DE).every((v) => v.trim().length > 0)).toBe(true));
});
