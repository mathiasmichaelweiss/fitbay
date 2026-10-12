import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { makeAuthorizer, ROLES_CLAIM } from './authorizer';

const issuer = 'https://fitbay-test.eu.auth0.com/';
const audience = 'https://api.fitbay.app';
let sign: (claims: Record<string, unknown>, opts?: { iss?: string; aud?: string; exp?: string }) => Promise<string>;
let auth: ReturnType<typeof makeAuthorizer>;

const ev = (authorization?: string) => ({ headers: authorization ? { authorization } : {} }) as unknown as APIGatewayRequestAuthorizerEventV2;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  auth = makeAuthorizer({ issuer, audience, keys: createLocalJWKSet({ keys: [jwk] }) });
  sign = (claims, o = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(o.iss ?? issuer)
      .setAudience(o.aud ?? audience)
      .setSubject('auth0|u1')
      .setIssuedAt()
      .setExpirationTime(o.exp ?? '1h')
      .sign(privateKey);
});

describe('authorizer', () => {
  it('без токена: отказ (API Gateway вернёт 401)', async () => {
    expect((await auth(ev())).isAuthorized).toBe(false);
  });
  it('мусор вместо токена: отказ', async () => {
    expect((await auth(ev('Bearer abc.def.ghi'))).isAuthorized).toBe(false);
  });
  it('валидный токен: uid и роль client по умолчанию', async () => {
    const r = await auth(ev(`Bearer ${await sign({})}`));
    expect(r).toEqual({ isAuthorized: true, context: { uid: 'auth0|u1', roles: 'client' } });
  });
  it('роли из custom claim, неизвестные отбрасываются', async () => {
    const r = await auth(ev(`Bearer ${await sign({ [ROLES_CLAIM]: ['trainer', 'hacker', 'admin'] })}`));
    expect(r.context).toEqual({ uid: 'auth0|u1', roles: 'trainer,admin' });
  });
  it('чужой issuer: отказ', async () => {
    expect((await auth(ev(`Bearer ${await sign({}, { iss: 'https://evil.example/' })}`))).isAuthorized).toBe(false);
  });
  it('чужой audience: отказ', async () => {
    expect((await auth(ev(`Bearer ${await sign({}, { aud: 'other' })}`))).isAuthorized).toBe(false);
  });
  it('просроченный токен: отказ', async () => {
    expect((await auth(ev(`Bearer ${await sign({}, { exp: '-1m' })}`))).isAuthorized).toBe(false);
  });
});
