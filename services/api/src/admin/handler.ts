import { DynamoRepo, type Repo } from '../lib/repo';
import { body, caller, handle, HttpError, json, type Event, type Result } from '../lib/http';
import { deleteTestUser, seedTestUser, TU_PRESETS, TU_ROLES, tuPks } from './testusers';

/**
 * A6.1 Тестовые пользователи владельца (openTu, tuCreate, tuSwitch прототипа).
 * GET  /admin/testusers         список (USER#<owner>/TESTUSERS)
 * POST /admin/testusers {kind}  создать и заполнить данными
 * DELETE /admin/testusers/{id}  удалить со всеми данными
 * Открывается тестовый пользователь заголовком x-act-as (lib/http.caller).
 */
export function makeHandler(repo: Repo, now: () => number = Date.now) {
  return (e: Event): Promise<Result> =>
    handle(e, async () => {
      const who = caller(e);
      if (!who.roles.includes('admin') || who.uid.includes('~')) throw new HttpError(403, 'admin only');
      const pk = `USER#${who.uid}`;
      const cur = await repo.get(pk, 'TESTUSERS');
      const list = ((cur?.list as { id: string; kind: string; name: string; desc: string; at: number; roles: string }[]) ?? []).slice();
      const method = e.requestContext.http.method;
      const id = e.pathParameters?.id;
      if (method === 'GET') return json(200, { items: list, presets: TU_PRESETS.map(([kind, name, desc]) => ({ kind, name, desc })) });
      if (method === 'POST') {
        const kind = String(body(e).kind ?? '');
        const P = TU_PRESETS.find((x) => x[0] === kind);
        if (!P) throw new HttpError(400, 'unknown kind');
        const tid = `t${now().toString(36)}`;
        const tu = `${who.uid}~${tid}`;
        await seedTestUser(repo, tu, kind, now());
        const ent = { id: tid, kind, name: kind === 'trainer_de' ? 'Lukas Weber (Trainer, DE)' : `${P[1]} ${list.filter((u) => u.kind === kind).length + 1}`, desc: P[2], at: now(), roles: TU_ROLES[kind] ?? 'client' };
        list.push(ent);
        await repo.put({ PK: pk, SK: 'TESTUSERS', list });
        return json(201, { ...ent, uid: tu });
      }
      if (method === 'DELETE' && id) {
        const u = list.find((x) => x.id === id);
        if (!u) throw new HttpError(404, 'not found');
        await deleteTestUser(repo, tuPks(`${who.uid}~${id}`, u.kind));
        await repo.put({ PK: pk, SK: 'TESTUSERS', list: list.filter((x) => x.id !== id) });
        return json(204, undefined);
      }
      throw new HttpError(405, 'method not allowed');
    });
}

export const handler = makeHandler(new DynamoRepo(process.env.TABLE_MAIN ?? 'fitbay-main'));
