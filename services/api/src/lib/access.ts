import type { Repo } from './repo';
import { HttpError, type AuthContext } from './http';

/**
 * Спека 5.3: свои данные только владелец; данные клиента читает тренер со связью
 * TRAINER#<tid>/CLIENT#<uid> и действующим согласием (consent=true); админ видит всё.
 * В бете tid тренера совпадает с его uid. Тренер читает всё, а пишет только то, что ведет сам:
 * рекомендации (tips) и план целей (plan), как в прототипе (DB.shared("tips"), DB.shared("plans")).
 */
export const TRAINER_WRITABLE = new Set(['tips', 'plan']);
export async function assertCanAccess(repo: Repo, who: AuthContext, uid: string, write = false, entity?: string): Promise<void> {
  if (who.uid === uid) return;
  if (who.roles.includes('admin')) return;
  if ((!write || (entity && TRAINER_WRITABLE.has(entity))) && (who.roles.includes('trainer') || who.roles.includes('partner'))) {
    const link = await repo.get(`TRAINER#${who.uid}`, `CLIENT#${uid}`);
    if (link?.consent === true) return;
  }
  throw new HttpError(403, 'forbidden');
}
