import { describe, expect, it } from 'vitest';
import { bmr } from './index';

describe('bmr', () => {
  it('мужчина', () => expect(bmr('m', 80, 180, 30)).toBe(1780));
  it('женщина', () => expect(bmr('f', 60, 165, 30)).toBe(1320));
  it('граничный: возраст 0', () => expect(bmr('m', 0, 0, 0)).toBe(5));
});
