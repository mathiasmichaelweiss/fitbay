import { addCorrection, communityFor, communityIndex, type WeightCorr } from '@fitbay/calc';
import { DynamoRepo, type Repo } from '../lib/repo';
import { body, caller, handle, HttpError, json, type Event, type Result } from '../lib/http';

/**
 * A2.6 Поправки веса (спека 4.2, 5.1). Как в прототипе (saveMeal → wcorr):
 * - личный список пользователя: USER#<uid> / WCORR в fitbay-main (последние 30);
 * - общая база: WCORR / <uid> в fitbay-shared-food. Пользователь не знает, что поправка уходит в общую базу.
 */
export async function recordCorrection(main: Repo, shared: Repo, uid: string, dish: string, est: number, real: number, at: number) {
  const prev = await main.get(`USER#${uid}`, 'WCORR');
  const list = addCorrection(((prev?.list as WeightCorr[]) ?? []), dish, est, real, at);
  if (!list) return false;
  await main.put({ ...(prev ?? {}), PK: `USER#${uid}`, SK: 'WCORR', list, updatedAt: new Date(at).toISOString() });
  await shared.put({ PK: 'WCORR', SK: uid, list, at });
  return true;
}

/** Коэффициент сообщества по блюду (для подсказки в промпт фото, A2.5). Только на сервере. */
export async function communityHint(shared: Repo, name: string) {
  const docs = Object.fromEntries((await shared.query('WCORR')).map((d) => [d.SK, (d.list as WeightCorr[]) ?? []]));
  return communityFor(communityIndex(docs), name);
}

/** Личные поправки пользователя (последние 12 идут в промпт, как в прототипе). */
export async function personalCorrections(main: Repo, uid: string): Promise<WeightCorr[]> {
  return ((await main.get(`USER#${uid}`, 'WCORR'))?.list as WeightCorr[]) ?? [];
}

export function makeHandler(main: Repo, shared: Repo, now: () => number = Date.now) {
  return (e: Event): Promise<Result> =>
    handle(e, async () => {
      const who = caller(e);
      const b = body(e);
      const dish = typeof b.dish === 'string' ? b.dish.trim().slice(0, 120) : '';
      const est = Number(b.est), real = Number(b.real);
      if (!dish || !(est > 0) || !(real > 0)) throw new HttpError(400, 'dish, est, real required');
      const saved = await recordCorrection(main, shared, who.uid, dish, est, real, now());
      return json(200, { saved });
    });
}

export const handler = makeHandler(new DynamoRepo(process.env.TABLE_MAIN ?? 'fitbay-main'), new DynamoRepo(process.env.TABLE_SHARED_FOOD ?? 'fitbay-shared-food'));
