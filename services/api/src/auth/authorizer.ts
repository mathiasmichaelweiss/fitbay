import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from 'aws-lambda';
import type { Role } from '@fitbay/shared';

export const ROLES_CLAIM = 'https://fitbay.app/roles';
const KNOWN: Role[] = ['client', 'trainer', 'partner', 'studio', 'admin'];

export interface AuthorizerConfig {
  issuer: string; // https://<tenant>.eu.auth0.com/
  audience: string; // API identifier в Auth0
  keys: JWTVerifyGetKey;
}

type Ctx = { uid: string; roles: string };
type Res = APIGatewaySimpleAuthorizerWithContextResult<Ctx | Record<string, never>>;

export function rolesFrom(payload: JWTPayload): Role[] {
  const raw = payload[ROLES_CLAIM];
  const list = Array.isArray(raw) ? raw.filter((r): r is Role => KNOWN.includes(r as Role)) : [];
  return list.length ? list : ['client'];
}

/** Lambda authorizer для HTTP API (simple responses). Неавторизованный запрос API Gateway превращает в 401. */
export function makeAuthorizer(cfg: AuthorizerConfig) {
  return async (event: APIGatewayRequestAuthorizerEventV2): Promise<Res> => {
    const header = event.headers?.authorization ?? event.headers?.Authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return { isAuthorized: false, context: {} };
    try {
      const { payload } = await jwtVerify(token, cfg.keys, { issuer: cfg.issuer, audience: cfg.audience, algorithms: ['RS256'] });
      if (!payload.sub) return { isAuthorized: false, context: {} };
      return { isAuthorized: true, context: { uid: payload.sub, roles: rolesFrom(payload).join(',') } };
    } catch {
      return { isAuthorized: false, context: {} };
    }
  };
}

const domain = process.env.AUTH0_DOMAIN ?? 'example.eu.auth0.com';
const issuer = `https://${domain}/`;
export const handler = makeAuthorizer({
  issuer,
  audience: process.env.AUTH0_AUDIENCE ?? 'https://api.fitbay.app',
  keys: createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`)),
});
