/**
 * Таблица маршрутов API. Одна на всех: локальный сервер (src/local/server.ts) и CDK-стек (infra).
 * handler: имя модуля-обработчика; auth=false только для публичных маршрутов.
 */
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
export interface Route {
  method: Method;
  path: string;
  handler: 'health' | 'user' | 'trainer' | 'corrections' | 'ai';
  auth?: boolean;
}

const crud: Method[] = ['GET', 'POST', 'PUT', 'DELETE'];
const many = (paths: string[], methods: Method[], handler: Route['handler']): Route[] =>
  paths.flatMap((path) => methods.map((method) => ({ method, path, handler })));

export const ROUTES: Route[] = [
  { method: 'GET', path: '/health', handler: 'health', auth: false },
  // A2.3: свои данные и данные клиента для тренера
  { method: 'DELETE', path: '/me', handler: 'user' },
  { method: 'GET', path: '/me/export', handler: 'user' },
  ...many(['/me/{entity}', '/me/{entity}/{id}'], crud, 'user'),
  { method: 'DELETE', path: '/users/{uid}', handler: 'user' },
  { method: 'GET', path: '/users/{uid}/export', handler: 'user' },
  ...many(['/users/{uid}/{entity}', '/users/{uid}/{entity}/{id}'], crud, 'user'),

  // A2.4: кабинет тренера
  ...many(['/trainer/profile'], ['GET', 'PUT'], 'trainer'),
  ...many(['/trainer/clients', '/trainer/requests', '/trainer/overview'], ['GET'], 'trainer'),
  ...many(['/trainer/slots'], ['GET', 'POST'], 'trainer'),
  { method: 'DELETE', path: '/trainer/slots/{id}', handler: 'trainer' },
  ...many(['/trainer/slots/{id}/cancel', '/trainer/slots/{id}/note', '/trainer/requests/{id}/answer', '/trainer/requests/{id}/adjust'], ['POST'], 'trainer'),
  // A2.4: клиент и тренер
  ...many(['/trainers', '/trainers/by-code/{code}', '/trainers/{tid}', '/trainers/{tid}/slots'], ['GET'], 'trainer'),
  ...many(['/trainers/{tid}/slots/{id}/book', '/trainers/{tid}/slots/{id}/cancel', '/trainers/{tid}/requests'], ['POST'], 'trainer'),
  ...many(['/trainers/{tid}/link'], ['PUT', 'DELETE'], 'trainer'),
  ...many(['/me/bookings', '/me/requests', '/me/links', '/me/notifications'], ['GET'], 'trainer'),
  { method: 'POST', path: '/me/notifications/read', handler: 'trainer' },
  // A2.6: поправка веса при сохранении блюда
  { method: 'POST', path: '/me/corrections', handler: 'corrections' },
  // A2.5: ИИ-прокси
  { method: 'POST', path: '/ai/{task}', handler: 'ai' },
];

/** Сопоставление пути с шаблоном '/me/{entity}/{id}'. Возвращает параметры или null. */
export function match(template: string, path: string): Record<string, string> | null {
  const t = template.split('/').filter(Boolean);
  const p = path.split('/').filter(Boolean);
  if (t.length !== p.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < t.length; i++) {
    const a = t[i]!, b = p[i]!;
    if (a.startsWith('{')) params[a.slice(1, -1)] = decodeURIComponent(b);
    else if (a !== b) return null;
  }
  return params;
}

/** Самый конкретный маршрут: сначала без параметров, потом с меньшим их числом. */
export function resolve(method: string, path: string): { route: Route; params: Record<string, string> } | null {
  const hits = ROUTES.filter((r) => r.method === method)
    .map((route) => ({ route, params: match(route.path, path) }))
    .filter((x): x is { route: Route; params: Record<string, string> } => x.params !== null)
    .sort((a, b) => Object.keys(a.params).length - Object.keys(b.params).length);
  return hits[0] ?? null;
}
