import { randomUUID } from 'node:crypto';
import { DynamoRepo, type Item, type Repo } from '../lib/repo';
import { assertCanAccess } from '../lib/access';
import { body, caller, handle, HttpError, json, type Event, type Result } from '../lib/http';
import { DATE_RE, ENTITIES, isEntity, PROTECTED, type Collection } from './entities';

const pk = (uid: string) => `USER#${uid}`;

/** Убирает ключи из ответа и защищённые поля из ввода. */
const toDto = ({ PK: _pk, SK, ...rest }: Item) => ({ id: SK.slice(SK.indexOf('#') + 1) || SK, ...rest });
const clean = (input: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(input).filter(([k]) => !PROTECTED.has(k) && k !== 'id'));

function newKey(e: Collection, input: Record<string, unknown>): string {
  const date = String(input.date ?? new Date().toISOString().slice(0, 10));
  if (e.key !== 'id' && !DATE_RE.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');
  if (e.key === 'date') return date;
  if (e.key === 'date-ts') return `${date}#${Date.now()}${randomUUID().slice(0, 4)}`;
  return randomUUID();
}

export function makeHandler(repo: Repo) {
  return (e: Event): Promise<Result> =>
    handle(e, async () => {
      const who = caller(e);
      const method = e.requestContext.http.method;
      const p = e.pathParameters ?? {};
      // /me/... = свои данные, /users/{uid}/... = чужие (тренер, админ).
      const uid = p.uid ?? who.uid;
      const write = method !== 'GET';
      await assertCanAccess(repo, who, uid, write, p.entity);

      // Экспорт и удаление аккаунта (DSGVO, спека 4.9).
      if (p.entity === undefined && e.rawPath.endsWith('/export')) {
        const items = await repo.query(pk(uid));
        return json(200, { exportedAt: new Date().toISOString(), uid, items: items.map(({ PK: _, ...i }) => i) });
      }
      if (p.entity === undefined && method === 'DELETE') {
        if (uid !== who.uid) throw new HttpError(403, 'only owner can delete account');
        const items = await repo.query(pk(uid));
        if (repo instanceof DynamoRepo) await repo.deleteMany(items.map(({ PK, SK }) => ({ PK, SK })));
        else for (const i of items) await repo.delete(i.PK, i.SK);
        return json(200, { deleted: items.length });
      }

      const name = p.entity ?? '';
      if (!isEntity(name)) throw new HttpError(404, 'unknown entity');
      const ent = ENTITIES[name];

      if (ent.kind === 'single') {
        if (method === 'GET') {
          const it = await repo.get(pk(uid), ent.sk);
          if (!it) throw new HttpError(404, 'not found');
          return json(200, toDto(it));
        }
        if (method === 'PUT') {
          const now = new Date().toISOString();
          const prev = await repo.get(pk(uid), ent.sk);
          const item: Item = { ...clean(body(e)), PK: pk(uid), SK: ent.sk, createdAt: prev?.createdAt ?? now, updatedAt: now };
          // план тренера хранит свою отметку изменения (ms), по ней колокольчик клиента и архив (plDiff прототипа)
          if (name === 'plan' && typeof body(e).updatedAt === 'number') item.updatedAt = body(e).updatedAt as number;
          if (name === 'profile' && prev) {
            // роль и подписку меняет только сервер
            for (const k of ['role', 'entitlement']) if (k in prev) item[k] = prev[k];
          }
          await repo.put(item);
          return json(200, toDto(item));
        }
        if (method === 'DELETE') {
          await repo.delete(pk(uid), ent.sk);
          return json(204, undefined);
        }
        throw new HttpError(405, 'method not allowed');
      }

      // Коллекции
      const id = p.id;
      if (!id) {
        if (method === 'GET') {
          const q = e.queryStringParameters ?? {};
          for (const d of [q.from, q.to]) if (d && !DATE_RE.test(d)) throw new HttpError(400, 'from/to must be YYYY-MM-DD');
          const items = await repo.query(pk(uid), {
            prefix: ent.prefix,
            from: q.from ? `${ent.prefix}${q.from}` : undefined,
            to: q.to ? `${ent.prefix}${q.to}￿` : undefined,
          });
          return json(200, { items: items.map(toDto) });
        }
        if (method === 'POST') {
          const input = body(e);
          const sk = `${ent.prefix}${newKey(ent, input)}`;
          if (ent.key === 'date' && (await repo.get(pk(uid), sk))) throw new HttpError(409, 'already exists for this date, use PUT');
          const now = new Date().toISOString();
          const item: Item = { ...clean(input), PK: pk(uid), SK: sk, createdAt: now, updatedAt: now };
          await repo.put(item);
          return json(201, toDto(item));
        }
        throw new HttpError(405, 'method not allowed');
      }

      const sk = `${ent.prefix}${decodeURIComponent(id)}`;
      const existing = await repo.get(pk(uid), sk);
      if (method === 'GET') {
        if (!existing) throw new HttpError(404, 'not found');
        return json(200, toDto(existing));
      }
      if (method === 'PUT') {
        // для «одна запись в день» PUT создаёт запись (upsert), для остальных только обновляет
        if (!existing && ent.key !== 'date') throw new HttpError(404, 'not found');
        if (!existing && !DATE_RE.test(id)) throw new HttpError(400, 'id must be YYYY-MM-DD');
        const now = new Date().toISOString();
        // PUT дополняет запись (как update в local-режиме): поля, которых нет в теле, сохраняются
        const item: Item = { ...(existing ?? {}), ...clean(body(e)), PK: pk(uid), SK: sk, createdAt: existing?.createdAt ?? now, updatedAt: now };
        await repo.put(item);
        return json(200, toDto(item));
      }
      if (method === 'DELETE') {
        if (!existing) throw new HttpError(404, 'not found');
        await repo.delete(pk(uid), sk);
        return json(204, undefined);
      }
      throw new HttpError(405, 'method not allowed');
    });
}

export const handler = makeHandler(new DynamoRepo(process.env.TABLE_MAIN ?? 'fitbay-main'));
