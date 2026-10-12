import type { IncomingHttpHeaders } from 'node:http';
import { createRemoteJWKSet } from 'jose';
import { makeAuthorizer } from './authorizer';

export interface Caller {
  uid: string;
  roles: string;
}

/**
 * Вход для локального сервера.
 * - Если задан AUTH0_DOMAIN: настоящая проверка JWT тем же кодом, что и Lambda authorizer.
 * - Иначе режим разработки: пользователь из заголовков x-dev-user и x-dev-roles (по умолчанию «local», client).
 *   Так можно переключаться между тестовыми клиентом и тренером без Auth0 (спека A6.1).
 */
export function makeLocalAuth(env = process.env) {
  if (env.AUTH0_DOMAIN) {
    const issuer = `https://${env.AUTH0_DOMAIN}/`;
    const verify = makeAuthorizer({
      issuer,
      audience: env.AUTH0_AUDIENCE ?? 'https://api.fitbay.app',
      keys: createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`)),
    });
    return async (h: IncomingHttpHeaders): Promise<Caller | null> => {
      const r = await verify({ headers: { authorization: String(h.authorization ?? '') } } as never);
      return r.isAuthorized ? (r.context as Caller) : null;
    };
  }
  return async (h: IncomingHttpHeaders): Promise<Caller | null> => {
    const uid = String(h['x-dev-user'] ?? env.DEV_USER ?? 'local').trim();
    const roles = String(h['x-dev-roles'] ?? env.DEV_ROLES ?? 'client');
    return /^[\w.|@-]{1,64}$/.test(uid) ? { uid, roles } : null;
  };
}
