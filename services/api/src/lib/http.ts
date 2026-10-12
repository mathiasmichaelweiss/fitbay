import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { Role } from '@fitbay/shared';

export interface AuthContext {
  uid: string;
  roles: Role[];
}
export type Event = APIGatewayProxyEventV2WithLambdaAuthorizer<AuthContext | { uid: string; roles: string }>;
export type Result = APIGatewayProxyStructuredResultV2;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (status: number, body: unknown): Result => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? '' : JSON.stringify(body),
});

/** Контекст, который положил Lambda authorizer. Роли приходят строкой (ограничение API Gateway). */
export function caller(e: Event): AuthContext {
  const ctx = e.requestContext.authorizer?.lambda;
  if (!ctx?.uid) throw new HttpError(401, 'unauthorized');
  const roles = Array.isArray(ctx.roles) ? ctx.roles : String(ctx.roles ?? '').split(',').filter(Boolean);
  // A6.1 тестовые пользователи: владелец (admin) действует от имени своего тестового пользователя <uid>~<id>
  // (TU в прототипе). Чужих тестовых и обычных пользователей так открыть нельзя.
  const as = e.headers?.['x-act-as'];
  if (as && roles.includes('admin') && as.startsWith(`${ctx.uid}~`)) {
    const r = String(e.headers?.['x-act-roles'] ?? 'client').split(',').filter((x) => x === 'client' || x === 'trainer');
    return { uid: as, roles: (r.length ? r : ['client']) as Role[] };
  }
  return { uid: ctx.uid, roles: roles as Role[] };
}

export function body<T = Record<string, unknown>>(e: Event): T {
  if (!e.body) return {} as T;
  try {
    const raw = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString('utf8') : e.body;
    const v = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error();
    return v as T;
  } catch {
    throw new HttpError(400, 'invalid json body');
  }
}

/** Логи без персональных данных (спека 7): только метод, путь-шаблон, статус. */
export async function handle(e: Event, fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error(JSON.stringify({ route: e.routeKey, error: (err as Error).name }));
    return json(500, { error: 'internal' });
  }
}
