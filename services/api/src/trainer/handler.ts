import { randomUUID } from 'node:crypto';
import { finOverview, isLateCancel, pkgSessDefault, pkgUsage, type PkgRequest, type SlotLike } from '@fitbay/calc';
import { ConditionFailed, DynamoRepo, type Item, type Repo } from '../lib/repo';
import { body, caller, handle, HttpError, json, type AuthContext, type Event, type Result } from '../lib/http';

/**
 * A2.4 API тренера и записи к тренеру. Поведение из прототипа:
 * bookSlot, отмена клиентом (24 часа: бесплатно / сгорает), отмена тренером (занятие остаётся у клиента),
 * cabPkgClick (принятие заявки с числом занятий, ручное списание и возврат с журналом и уведомлением),
 * renderFin (обзор денег). Ключи по спеке 5.2.
 */
const T = (tid: string) => `TRAINER#${tid}`;
const U = (uid: string) => `USER#${uid}`;
const C = (uid: string) => `CLIENT#${uid}`;
const DAY = 864e5;

const strip = ({ PK: _p, SK, GSI1PK: _a, GSI1SK: _b, GSI2PK: _c, GSI2SK: _d, GSI3PK: _e, GSI3SK: _f, ...rest }: Item): Record<string, unknown> & { id: string } => ({ id: SK.slice(SK.indexOf('#') + 1), ...rest });
/** Профиль тренера наружу: id = uid тренера (SK у профиля всегда PROFILE). */
const tProfile = (it: Item) => ({ ...strip(it), id: String(it.PK).slice(8) });
const isTrainer = (w: AuthContext) => w.roles.some((r) => r === 'trainer' || r === 'partner' || r === 'admin');
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function makeHandler(repo: Repo, now: () => number = Date.now) {
  let seq = 0;
  /** Уведомление в колокольчик (A3.7). Ключ сортируется по времени, при равном времени по порядку создания. */
  const notify = async (uid: string, n: Record<string, unknown>) => {
    const at = now();
    const sk = `NOTIF#${String(at).padStart(15, '0')}_${String(seq++ % 1e6).padStart(6, '0')}_${randomUUID().slice(0, 4)}`;
    await repo.put({ PK: U(uid), SK: sk, ...n, at, read: false });
  };
  const getProfile = (tid: string) => repo.get(T(tid), 'PROFILE');
  const slotsOf = async (tid: string) => (await repo.query(T(tid), { prefix: 'SLOT#' })).map(strip) as unknown as (SlotLike & { id: string } & Record<string, unknown>)[];
  const reqsOf = async (tid: string) => (await repo.query(T(tid), { prefix: 'REQ#' })).map(strip) as unknown as (PkgRequest & { id: string } & Record<string, unknown>)[];

  /** Слот с ключами GSI1 (записи клиента). Свободный слот из индекса клиента выпадает. */
  const slotItem = (tid: string, id: string, s: Record<string, unknown>): Item => {
    const it: Item = { ...s, PK: T(tid), SK: `SLOT#${id}`, trainer: tid };
    delete it.id;
    if (s.bookedBy) {
      it.GSI1PK = C(String(s.bookedBy));
      it.GSI1SK = `SLOT#${s.start}`;
    } else {
      delete it.GSI1PK;
      delete it.GSI1SK;
    }
    return it;
  };
  const reqItem = (tid: string, id: string, r: Record<string, unknown>): Item => {
    const it: Item = { ...r, PK: T(tid), SK: `REQ#${id}`, GSI1PK: C(String(r.uid)), GSI1SK: `REQ#${r.at}` };
    delete it.id;
    return it;
  };
  /** Оптимистичная блокировка: запись проходит, только если версия не изменилась (без потерянных списаний). */
  const saveVersioned = async (item: Item) => {
    const v = Number(item.v ?? 0);
    try {
      await repo.putIf({ ...item, v: v + 1 }, v ? { eq: ['v', v] } : { exists: true });
    } catch (e) {
      if (e instanceof ConditionFailed) throw new HttpError(409, 'changed, retry');
      throw e;
    }
  };

  return (e: Event): Promise<Result> =>
    handle(e, async () => {
      const who = caller(e);
      const method = e.requestContext.http.method;
      const p = e.pathParameters ?? {};
      const route = e.routeKey.replace(/^\w+ /, '');

      /* ---------- кабинет тренера: /trainer/... ---------- */
      if (route.startsWith('/trainer/')) {
        if (!isTrainer(who)) throw new HttpError(403, 'trainer only');
        const tid = who.uid;

        if (route === '/trainer/profile') {
          if (method === 'GET') {
            const it = await getProfile(tid);
            if (!it) throw new HttpError(404, 'not found');
            return json(200, strip(it));
          }
          const b = body(e);
          const prev = await getProfile(tid);
          const partner = who.roles.includes('partner');
          const code = partner ? str(b.code, 24).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
          if (code) {
            const taken = (await repo.queryIndex('GSI3', `CODE#${code}`)).find((x) => x.PK !== T(tid));
            if (taken) throw new HttpError(409, 'code taken');
          }
          const it: Item = {
            ...(prev ?? {}),
            name: str(b.name, 80), bio: str(b.bio, 2000), gym: str(b.gym, 200), city: str(b.city, 80),
            // карточка каталога (renderCatList, renderTrainer прототипа)
            spec: str(b.spec, 200), about: str(b.about, 2000), level: str(b.level, 80), price: str(b.price, 40),
            exp: Math.max(0, Math.min(60, Number(b.exp) || 0)), sex: b.sex === 'm' || b.sex === 'f' ? b.sex : '',
            edu: Array.isArray(b.edu) ? b.edu.filter((x): x is string => typeof x === 'string').slice(0, 8) : (prev?.edu ?? []),
            online: b.online !== false, formats: Array.isArray(b.formats) ? b.formats.slice(0, 6) : (prev?.formats ?? []), color: str(b.color, 16),
            packages: Array.isArray(b.packages) ? b.packages.slice(0, 30) : (prev?.packages ?? []),
            rates: typeof b.rates === 'object' && b.rates ? b.rates : (prev?.rates ?? {}),
            tags: Array.isArray(b.tags) ? b.tags.slice(0, 20) : (prev?.tags ?? []),
            hidden: !!b.hidden, partner, uid: tid,
            PK: T(tid), SK: 'PROFILE', updatedAt: new Date(now()).toISOString(),
          };
          if (!it.hidden) {
            it.GSI2PK = 'CATALOG';
            it.GSI2SK = String(b.order ?? prev?.GSI2SK ?? '5000').padStart(6, '0');
          } else delete it.GSI2PK;
          if (code) {
            it.code = code;
            it.GSI3PK = `CODE#${code}`;
            it.GSI3SK = 'TRAINER';
          } else {
            delete it.code;
            delete it.GSI3PK;
          }
          await repo.put(it);
          return json(200, strip(it));
        }

        if (route === '/trainer/clients') {
          const links = (await repo.query(T(tid), { prefix: 'CLIENT#' })).map(strip);
          return json(200, { items: links });
        }

        if (route === '/trainer/slots') {
          if (method === 'GET') return json(200, { items: await slotsOf(tid) });
          // openSlotForm: дата, начало, длительность, слотов подряд, где
          const b = body(e);
          const start = Number(b.start);
          const dur = Math.min(240, Math.max(15, Number(b.dur) || 60));
          const n = Math.min(8, Math.max(1, Number(b.n) || 1));
          if (!Number.isFinite(start) || start < now() - DAY) throw new HttpError(400, 'start must be a future timestamp (ms)');
          const place = b.place === 'gym' ? 'gym' : 'online';
          const made = [];
          for (let i = 0; i < n; i++) {
            const s = start + i * dur * 6e4;
            const id = `${new Date(s).toISOString()}_${randomUUID().slice(0, 6)}`;
            const it = slotItem(tid, id, { start: s, dur, place, addr: place === 'gym' ? str(b.addr, 200) : '', bookedBy: null, createdAt: now() });
            await repo.put(it);
            made.push(strip(it));
          }
          return json(201, { items: made });
        }

        const slotId = p.id;
        if (route === '/trainer/slots/{id}' && method === 'DELETE') {
          const it = await repo.get(T(tid), `SLOT#${slotId}`);
          if (!it) throw new HttpError(404, 'not found');
          if (it.bookedBy) throw new HttpError(409, 'slot is booked, cancel it first');
          await repo.delete(T(tid), `SLOT#${slotId}`);
          return json(204, undefined);
        }
        if (route === '/trainer/slots/{id}/cancel') {
          // Тренер отменяет занятие клиента: занятие остаётся у клиента в пакете, клиент получает причину.
          const it = await repo.get(T(tid), `SLOT#${slotId}`);
          if (!it?.bookedBy) throw new HttpError(404, 'no booking');
          const reason = str(body(e).reason, 300);
          const client = String(it.bookedBy);
          const upd = slotItem(tid, String(slotId), {
            ...strip(it), bookedBy: null, bookedName: null, bookedAt: null, burned: null,
            cancel: { by: 'trainer', name: it.bookedName ?? '', uid: client, at: now(), reason },
            cancelledFor: client,
          });
          await repo.put(upd);
          await notify(client, { type: 'cancel', by: 'trainer', trainer: tid, start: it.start, reason });
          return json(200, strip(upd));
        }
        if (route === '/trainer/slots/{id}/note') {
          // заметки тренера только к совместным занятиям (спека 4.5)
          const it = await repo.get(T(tid), `SLOT#${slotId}`);
          if (!it?.bookedBy) throw new HttpError(404, 'no booking');
          const upd = { ...it, tnote: str(body(e).note, 2000) };
          await repo.put(upd);
          return json(200, strip(upd));
        }

        if (route === '/trainer/requests') return json(200, { items: await reqsOf(tid) });
        if (route === '/trainer/requests/{id}/answer') {
          const it = await repo.get(T(tid), `REQ#${p.id}`);
          if (!it) throw new HttpError(404, 'not found');
          if (it.status !== 'new') throw new HttpError(409, 'already answered');
          const b = body(e);
          const ok = b.accept === true;
          const sessions = Math.max(1, Math.round(Number(b.sessions) || pkgSessDefault(it as unknown as PkgRequest)));
          const upd: Item = { ...it, status: ok ? 'accepted' : 'declined', answer: str(b.answer, 1000), answeredAt: now(), ...(ok ? { sessions: { total: sessions }, adj: 0, log: [] } : {}) };
          await saveVersioned(upd);
          await notify(String(it.uid), { type: ok ? 'req_accepted' : 'req_declined', trainer: tid, req: p.id, sessions: ok ? sessions : undefined });
          return json(200, strip(upd));
        }
        if (route === '/trainer/requests/{id}/adjust') {
          // Ручное списание (+1) или возврат (−1). Журнал только дополняется, клиент получает уведомление (защита от жульничества).
          const it = await repo.get(T(tid), `REQ#${p.id}`);
          if (!it || it.status !== 'accepted') throw new HttpError(404, 'no active package');
          const d = Number(body(e).d);
          if (d !== 1 && d !== -1) throw new HttpError(400, 'd must be 1 or -1');
          const prof = await getProfile(tid);
          const entry = { d, at: now(), by: String(prof?.name ?? '') };
          const upd: Item = { ...it, adj: (Number(it.adj) || 0) + d, log: [...((it.log as unknown[]) ?? []), entry].slice(-50) };
          await saveVersioned(upd);
          await notify(String(it.uid), { type: d > 0 ? 'sess_charged' : 'sess_returned', trainer: tid, req: p.id, d });
          return json(200, strip(upd));
        }
        if (route === '/trainer/overview') {
          const [reqs, slots, links, prof] = await Promise.all([reqsOf(tid), slotsOf(tid), repo.query(T(tid), { prefix: 'CLIENT#' }), getProfile(tid)]);
          const clients = await Promise.all(links.map(async (l) => ({ updatedAt: Date.parse(String((await repo.get(U(l.SK.slice(7)), 'PROFILE'))?.updatedAt ?? '')) || 0 })));
          const f = finOverview(reqs, slots, clients, !!prof?.partner, now());
          return json(200, f);
        }
        throw new HttpError(404, 'unknown route');
      }

      /* ---------- клиент: каталог, запись, заявки ---------- */
      if (route === '/trainers') {
        const items = (await repo.queryIndex('GSI2', 'CATALOG')).map(tProfile).map(({ code: _code, ...t }) => t); // коды только у партнёров и не в каталоге
        return json(200, { items });
      }
      if (route === '/trainers/by-code/{code}') {
        const hit = (await repo.queryIndex('GSI3', `CODE#${String(p.code).toUpperCase()}`))[0];
        if (!hit) throw new HttpError(404, 'code not found');
        return json(200, tProfile(hit));
      }
      const tid = String(p.tid ?? '');
      if (route === '/trainers/{tid}') {
        const it = await getProfile(tid);
        if (!it) throw new HttpError(404, 'not found');
        const { code: _c, ...t } = tProfile(it);
        return json(200, t);
      }
      if (route === '/trainers/{tid}/slots') {
        // Свободные окна на 2 недели + мои записи у этого тренера. Чужие имена не отдаём.
        const t0 = now();
        const items = (await slotsOf(tid))
          .filter((s) => (s.bookedBy === who.uid || (!s.bookedBy && s.start > t0)) && s.start < t0 + 14 * DAY + DAY)
          .map((s) => (s.bookedBy === who.uid ? s : { id: s.id, start: s.start, dur: s.dur, place: s.place, addr: s.addr, trainer: s.trainer }));
        return json(200, { items });
      }
      if (route === '/trainers/{tid}/slots/{id}/book') {
        const name = str(body(e).name, 80);
        if (!name) throw new HttpError(400, 'Напиши, как тебя записать.');
        const it = await repo.get(T(tid), `SLOT#${p.id}`);
        if (!it) throw new HttpError(404, 'not found');
        if (it.bookedBy) throw new HttpError(409, 'Этот слот уже заняли. Выбери другое время.');
        if (Number(it.start) <= now()) throw new HttpError(409, 'slot in the past');
        const upd = slotItem(tid, String(p.id), { ...strip(it), bookedBy: who.uid, bookedName: name, bookedAt: now(), cancel: null, burned: null });
        try {
          await repo.putIf(upd, { exists: true, empty: 'bookedBy' }); // атомарно: второй бронирующий получит 409
        } catch (err) {
          if (err instanceof ConditionFailed) throw new HttpError(409, 'Этот слот уже заняли. Выбери другое время.');
          throw err;
        }
        await notify(tid, { type: 'booked', client: who.uid, name, start: it.start });
        return json(200, strip(upd));
      }
      if (route === '/trainers/{tid}/slots/{id}/cancel') {
        const it = await repo.get(T(tid), `SLOT#${p.id}`);
        if (!it || it.bookedBy !== who.uid) throw new HttpError(404, 'no booking');
        if (it.burned) throw new HttpError(409, 'already burned');
        const reason = str(body(e).reason, 300);
        const late = isLateCancel(Number(it.start), now());
        const name = it.bookedName ?? '';
        const upd = late
          ? slotItem(tid, String(p.id), { ...strip(it), burned: { at: now(), name, reason } }) // сгорает, запись остаётся
          : slotItem(tid, String(p.id), { ...strip(it), bookedBy: null, bookedName: null, bookedAt: null, cancel: { by: 'client', name, uid: who.uid, at: now(), reason } });
        await repo.put(upd);
        await notify(tid, { type: late ? 'burned' : 'cancel', by: 'client', client: who.uid, name, start: it.start, reason });
        return json(200, { late, slot: strip(upd) });
      }
      if (route === '/trainers/{tid}/requests') {
        if (!(await getProfile(tid))) throw new HttpError(404, 'trainer not found');
        const b = body(e);
        const contact = str(b.contact, 200);
        if (!contact) throw new HttpError(400, 'Напиши, как с тобой связаться.');
        const pkg = typeof b.pkg === 'object' && b.pkg ? (b.pkg as Record<string, unknown>) : null;
        if (!pkg) throw new HttpError(400, 'pkg required');
        const at = now();
        const id = `${at}_${randomUUID().slice(0, 6)}`;
        const it = reqItem(tid, id, { trainer: tid, uid: who.uid, name: str(b.name, 80), pkg, msg: str(b.msg, 1000), contact, status: 'new', answer: '', at, v: 1 });
        await repo.put(it);
        await notify(tid, { type: 'request', client: who.uid, req: id });
        return json(201, strip(it));
      }
      if (route === '/trainers/{tid}/requests/{id}') {
        // клиент отзывает свою заявку, пока тренер не ответил (data-pdel прототипа)
        const it = await repo.get(T(tid), `REQ#${p.id}`);
        if (!it || it.uid !== who.uid) throw new HttpError(404, 'not found');
        if (it.status !== 'new') throw new HttpError(409, 'already answered');
        await repo.delete(T(tid), `REQ#${p.id}`);
        return json(204, undefined);
      }
      if (route === '/trainers/{tid}/link') {
        // Связь клиент-тренер и согласие на доступ тренера к данным (спека 5.2, 5.3, A3.1).
        if (method === 'DELETE') {
          await repo.delete(T(tid), C(who.uid));
          return json(204, undefined);
        }
        if (!(await getProfile(tid))) throw new HttpError(404, 'trainer not found');
        const b = body(e);
        const prev = await repo.get(T(tid), C(who.uid));
        const me = await repo.get(U(who.uid), 'PROFILE');
        const it: Item = {
          PK: T(tid), SK: C(who.uid), GSI1PK: C(who.uid), GSI1SK: `LINK#${tid}`,
          consent: b.consent === true, since: prev?.since ?? now(), ref: str(b.ref, 24) || prev?.ref, name: str(b.name, 80) || me?.name || '',
        };
        await repo.put(it);
        return json(200, strip(it));
      }

      if (route === '/me/bookings') {
        const items = (await repo.queryIndex('GSI1', C(who.uid), { prefix: 'SLOT#' })).map(strip);
        const cancelled = (await Promise.all(
          [...new Set((await repo.queryIndex('GSI1', C(who.uid), { prefix: 'LINK#' })).map((l) => String(l.PK).slice(8)))].map(slotsOf),
        )).flat().filter((s) => s.cancelledFor === who.uid);
        return json(200, { items, cancelled });
      }
      if (route === '/me/requests') {
        const reqs = (await repo.queryIndex('GSI1', C(who.uid), { prefix: 'REQ#' })).map(strip) as unknown as (PkgRequest & Record<string, unknown>)[];
        const mySlots = (await repo.queryIndex('GSI1', C(who.uid), { prefix: 'SLOT#' })).map(strip) as unknown as SlotLike[];
        return json(200, { items: reqs.map((r) => ({ ...r, usage: pkgUsage(r, mySlots, now()) })) });
      }
      if (route === '/me/links') return json(200, { items: (await repo.queryIndex('GSI1', C(who.uid), { prefix: 'LINK#' })).map((l) => ({ trainer: String(l.PK).slice(8), consent: l.consent, since: l.since })) });
      if (route === '/me/notifications') {
        const items = (await repo.query(U(who.uid), { prefix: 'NOTIF#' })).reverse().slice(0, 100).map(strip);
        return json(200, { items });
      }
      if (route === '/me/notifications/read') {
        for (const it of await repo.query(U(who.uid), { prefix: 'NOTIF#' })) if (!it.read) await repo.put({ ...it, read: true });
        return json(204, undefined);
      }
      throw new HttpError(404, 'unknown route');
    });
}

export const handler = makeHandler(new DynamoRepo(process.env.TABLE_MAIN ?? 'fitbay-main'));
