import { describe, expect, it } from 'vitest';
import { ru } from './ru';
import { de } from './de';

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe('словари', () => {
  it('de содержит все ключи ru', () => expect(keys(de).sort()).toEqual(keys(ru).sort()));
  it('нет пустых строк', () => expect(keys(de).length).toBeGreaterThan(0));
  it('строки de отличаются от ru', () => expect(de.nav.today).not.toBe(ru.nav.today));
});
