# Локальный запуск FitBay

```bash
pnpm install
pnpm dev            # API на http://localhost:8787 и web на http://localhost:5173
```

## Данные
- Локальная база: `services/api/.data/db.json` (как таблица `fitbay-main`) и `db.shared-food.json` (как `fitbay-shared-food`). Удалить файлы = начать с чистого листа.
- Web в dev ходит в API (`apps/web/.env.development`). Если убрать `VITE_API_URL`, данные будут только в браузере.

## Вход (пока без Auth0)
- API берёт пользователя из заголовков `x-dev-user` и `x-dev-roles`. Web отправляет их из `localStorage['fitbay.devUser']`, по умолчанию `{"uid":"local","roles":"client"}`.
- Стать тренером: в консоли браузера `localStorage.setItem('fitbay.devUser', JSON.stringify({uid:'t1', roles:'trainer'}))` и обновить страницу. Переключатель тестовых пользователей появится в A6.1.
- Подключить Auth0 позже: задать `AUTH0_DOMAIN` и `AUTH0_AUDIENCE` для API, на фронте подставить токен в `auth.token()` (`apps/web/src/data/api.ts`). Подробно: `docs/AUTH0.md`.

## ИИ
- Без ключа ИИ выключен, API отвечает «ИИ недоступен в этом окне.»
- Тестовые ответы без ключа: `AI_MOCK=1 pnpm dev:api`.
- Настоящий: `OPENAI_API_KEY=sk-... pnpm dev:api`. Модель по умолчанию `gpt-5.6-luna` (`AI_MODEL` или запись `CONFIG / AI` в базе для каждой задачи отдельно).
- Перенесены промпты: еда по фото и тексту, рассказ за день, коуч. Остальные (активности, рецепт, ИИ-тренер, план, этикетка) переносятся вместе с их экранами.

## Тесты
```bash
pnpm test                 # юнит и интеграционные (API поднимается в памяти)
pnpm test:e2e             # Playwright: поднимает API с базой .data/e2e.json и web
```
