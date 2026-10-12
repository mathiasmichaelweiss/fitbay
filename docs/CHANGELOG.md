# Changelog

## 2026-10-12 · Пакет: A0.3 i18n, A5.1 навигация, A2.1 CDK-стек
- **A0.3** i18next, `ru` по умолчанию, `de`, язык меняется без перезагрузки и запоминается, `<html lang>` обновляется. Тест: в `de` есть все ключи `ru`.
  Открыто: `de` сейчас стартовый перевод, заменить словарём `DE` из прототипа.
- **A5.1** Каркас навигации: шапка (язык, колокольчик, настройки), нижняя панель из 4 разделов клиента, у тренера переключатель «Я / Кабинет» с разделами Клиенты, Расписание, Обзор, Шаблоны. Разделы пока с плитками-заглушками. До Auth0 роль тренера включается адресом `#/trainer`.
- **A2.1** `FitBayBetaStack`: `fitbay-main` (GSI1-3) и `fitbay-shared-food` (PAY_PER_REQUEST, PITR, TTL `ttl`, Retain), закрытый S3-бакет фото с CORS, HTTP API с `GET /health` на Lambda Node 24 (ARM). 5 юнит-тестов шаблона, `cdk synth` чистый. Деплой: `pnpm --filter @fitbay/infra deploy:beta` с профилем AWS `bewergo`.

## 2026-10-12 · A0.2 Дизайн-токены и базовые компоненты
- `tokens.css`: цвета (orange, yellow, teal), тёмные поверхности, шрифт Onest, шкала шрифтов, радиусы, отступы, тач-цель 44 px, safe-area.
- Компоненты в `apps/web/src/ui`: `Card`, `Tile`, `Button`, `Seg`, `Chip`, `Field`, `Sheet`.
- Витрина на `#/ui`. E2E: на 390 px нет горизонтального скролла, поля 16 px, шторка открывается.
- Открыто: радиусы, оттенки фона и отступы предварительные, сверить с CSS `kalorii.html`.

## 2026-10-12 · A0.1 Монорепо (каркас)
- Созданы `apps/web`, `apps/backoffice`, `packages/calc`, `packages/shared`, `services/api`, `infra`.
- TypeScript strict, ESLint, Prettier, Vitest (порог покрытия calc 90%), Playwright (mobile, smoke-тест).
- В `@fitbay/calc` первая функция `bmr` с 3 тестами.
- Осталось для закрытия A0.1: `pnpm install`, проверить `pnpm dev` и `pnpm test`.
