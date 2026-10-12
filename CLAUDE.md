# FitBay: правила для агента

Спека: `docs/SPEC.md`, задачи: `docs/TODO.md`, журнал: `docs/CHANGELOG.md` (новая запись сверху на каждый пакет).

## UI (обязательно)
- Основа всех компонентов: **shadcn/ui** в `apps/web/src/components/ui` (стиль new-york, Tailwind v4, Radix). Новый компонент: сначала берём shadcn-версию, потом стилизуем токенами из `src/tokens.css`.
- **Никаких нативных оверлеев и контролов**: нет `<select>`, `<input type="date|time|month">`, `<datalist>`, `alert/confirm/prompt`. Вместо них `Select`, `DatePicker` (шторка + `Calendar`), `Dialog`, `Drawer`, `Popover`. E2E `e2e/native.spec.ts` это проверяет.
- На мобильном основной оверлей: `Drawer` (снизу). Поля 16 px, тач-цели от 44 px, без горизонтального скролла на 360 px.
- Все строки через i18n (`ru`, `de`), ключи в обоих словарях (юнит-тест сверяет).
- Каждый новый компонент добавляем в витрину `/ui` (`src/Showcase.tsx`).

## Код
- Все производные числа (норма, расход, БЖУ) только из `@fitbay/calc`. Экраны только отображают.
- Данные фронта через `src/data/api.ts` (local или http) и хуки TanStack Query.

## Git
- До первого релиза пушим прямо в `main`, коммит на каждую задачу или пакет. После пуша обновить локальную копию Mathias (`git pull` в его папке).
