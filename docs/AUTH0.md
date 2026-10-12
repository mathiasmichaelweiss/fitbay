# Auth0 для FitBay (A2.2)

Код готов, нужна настройка в Auth0 (тенант BewerGO или отдельный).

1. **API.** Applications → APIs → Create API. Identifier: `https://api.fitbay.app` (это audience), алгоритм RS256.
2. **Приложение.** Applications → Create → Single Page Application «FitBay». Callback и Logout URL: `http://localhost:5173` и адрес беты. Connections: Username-Password и Google.
3. **Роли в токене.** Actions → Flows → Login → новое Action:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const roles = event.authorization?.roles ?? [];
     api.accessToken.setCustomClaim('https://fitbay.app/roles', roles.length ? roles : ['client']);
   };
   ```
   Роли создаются в User Management → Roles: `client`, `trainer`, `partner`, `studio`, `admin`.
4. **Деплой с настройками:**
   ```bash
   pnpm --filter @fitbay/infra exec cdk deploy FitBayBetaStack --profile bewergo \
     -c auth0Domain=<tenant>.eu.auth0.com -c auth0Audience=https://api.fitbay.app
   ```

## Маршруты API
| Маршрут | Что делает |
|---|---|
| `GET /health` | открыт, проверка живости |
| `GET,PUT,DELETE /me/{single}` | profile, plan, tips, before-after, weight-corrections, active-workout |
| `GET,POST /me/{collection}` | meals, recipes, coach, measures, workouts, programs, activities, checkins, templates; `?from=&to=` по датам |
| `GET,PUT,DELETE /me/{collection}/{id}` | одна запись; для measures, checkins, coach `PUT` по дате работает как upsert |
| `GET /me/export`, `DELETE /me` | экспорт и удаление аккаунта (DSGVO) |
| `GET /users/{uid}/...` | чтение данных клиента тренером (связь + согласие) или админом |

Без токена API Gateway отвечает 401, к чужим данным без связи и согласия API отвечает 403.
