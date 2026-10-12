/**
 * Сущности пользователя из спеки 5.2. PK всегда USER#<uid>.
 * collection: много записей, SK = <prefix><key>; key строится из даты и/или id.
 * single: одна запись на пользователя, SK фиксирован.
 */
export type Collection = {
  kind: 'collection';
  prefix: string;
  /** Как строить ключ при создании: date+ts (журналы), date (одна запись в день), id. */
  key: 'date-ts' | 'date' | 'id';
};
export type Single = { kind: 'single'; sk: string };

export const ENTITIES = {
  meals: { kind: 'collection', prefix: 'MEAL#', key: 'date-ts' },
  recipes: { kind: 'collection', prefix: 'RECIPE#', key: 'id' },
  coach: { kind: 'collection', prefix: 'COACH#', key: 'date' },
  measures: { kind: 'collection', prefix: 'MEASURE#', key: 'date' },
  workouts: { kind: 'collection', prefix: 'WORKOUT#', key: 'date-ts' },
  programs: { kind: 'collection', prefix: 'PROGRAM#', key: 'id' },
  activities: { kind: 'collection', prefix: 'ACT#', key: 'date-ts' },
  checkins: { kind: 'collection', prefix: 'CHECKIN#', key: 'date' },
  templates: { kind: 'collection', prefix: 'TPL#', key: 'id' },
  profile: { kind: 'single', sk: 'PROFILE' },
  plan: { kind: 'single', sk: 'PLAN' },
  tips: { kind: 'single', sk: 'TIPS' },
  'before-after': { kind: 'single', sk: 'BA' },
  'weight-corrections': { kind: 'single', sk: 'WCORR' },
  'active-workout': { kind: 'single', sk: 'WOACTIVE' },
} as const satisfies Record<string, Collection | Single>;

export type EntityName = keyof typeof ENTITIES;
export const isEntity = (s: string): s is EntityName => Object.hasOwn(ENTITIES, s);

/** Поля, которые клиент не может задать сам. */
export const PROTECTED = new Set(['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK', 'ttl', 'role', 'roles', 'entitlement']);

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
