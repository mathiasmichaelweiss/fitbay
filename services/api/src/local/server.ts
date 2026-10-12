import http from 'node:http';
import path from 'node:path';
import { FileRepo } from '../lib/file-repo';
import type { Repo } from '../lib/repo';
import type { Event, Result } from '../lib/http';
import { resolve, type Route } from '../routes';
import { makeLocalAuth } from '../auth/local';
import { makeHandler as makeUser } from '../user/handler';
import { handler as health } from '../health';
import { makeHandler as makeTrainer } from '../trainer/handler';

type H = (e: Event) => Promise<Result>;

/** Локальный API: те же обработчики, что в Lambda, маршрутизация как в API Gateway (HTTP API). */
export function createServer(repo: Repo, opts: { origins?: string[]; auth?: ReturnType<typeof makeLocalAuth>; now?: () => number } = {}) {
  const handlers: Record<Route['handler'], H | undefined> = {
    health: health as unknown as H,
    user: makeUser(repo),
    trainer: makeTrainer(repo, opts.now),
    corrections: undefined,
    ai: undefined,
  };
  const auth = opts.auth ?? makeLocalAuth();
  const origins = opts.origins ?? ['http://localhost:5173', 'http://localhost:5174'];

  return http.createServer(async (req, res) => {
    const origin = String(req.headers.origin ?? '');
    if (origins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-headers', 'authorization,content-type,x-dev-user,x-dev-roles');
      res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('vary', 'origin');
    }
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();

    const url = new URL(req.url ?? '/', 'http://local');
    const hit = resolve(req.method ?? 'GET', url.pathname);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (!hit) return send(404, { message: 'Not Found' });
    const fn = handlers[hit.route.handler];
    if (!fn) return send(501, { message: 'not implemented yet' });

    let lambda: { uid: string; roles: string } | undefined;
    if (hit.route.auth !== false) {
      const who = await auth(req.headers);
      if (!who) return send(401, { message: 'Unauthorized' }); // как API Gateway при отказе authorizer
      lambda = who;
    }

    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    const event = {
      rawPath: url.pathname,
      routeKey: `${hit.route.method} ${hit.route.path}`,
      requestContext: { http: { method: req.method }, authorizer: lambda ? { lambda } : undefined },
      pathParameters: hit.params,
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: req.headers,
      body: raw || undefined,
      isBase64Encoded: false,
    } as unknown as Event;
    try {
      const r = await fn(event);
      res.writeHead(r.statusCode ?? 200, { 'content-type': 'application/json', ...(r.headers as Record<string, string>) });
      res.end(r.body ?? '');
    } catch (err) {
      console.error(err);
      send(500, { error: 'internal' });
    }
  });
}

// Запуск: pnpm --filter @fitbay/api dev
if (process.argv[1]?.endsWith('server.ts')) {
  const port = Number(process.env.PORT ?? 8787);
  const file = process.env.DB_FILE ?? path.resolve(process.cwd(), '.data/db.json');
  createServer(new FileRepo(file)).listen(port, () => {
    console.log(`FitBay API: http://localhost:${port}  (база: ${file}, вход: ${process.env.AUTH0_DOMAIN ? 'Auth0' : 'dev, заголовок x-dev-user'})`);
  });
}
