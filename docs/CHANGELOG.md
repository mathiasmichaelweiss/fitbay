# Changelog

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
