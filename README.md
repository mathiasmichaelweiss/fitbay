# FitBay

Перенос прототипа FitBay (`kalorii.html`) в React-приложение. Спека: [docs/SPEC.md](docs/SPEC.md), ход работ: [docs/CHANGELOG.md](docs/CHANGELOG.md), задачи: [docs/TODO.md](docs/TODO.md).

## Старт
```bash
corepack enable        # включает pnpm
pnpm install
pnpm dev               # web на http://localhost:5173
pnpm test              # юнит-тесты
```

## Структура
| Папка | Что внутри |
|---|---|
| `apps/web` | клиентское приложение (React, Vite) |
| `apps/backoffice` | бэк-офис владельца |
| `packages/calc` | расчётное ядро, чистые функции |
| `packages/shared` | общие типы |
| `services/api` | Lambda-функции, промпты ИИ |
| `infra` | AWS CDK, скрипты миграции |
| `e2e` | Playwright-сценарии |
