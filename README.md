# cr

Просмотр чатов Cursor из `state.vscdb` и отправка в активный composer через CDP.

```bash
npm install
npm run build:ui
npm run dev          # http://127.0.0.1:3847
```

Cursor с remote debugging. UI — во **внешнем** браузере.

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PORT` | `3847` | HTTP порт |
| `CURSOR_DB` | auto | Путь к `state.vscdb` |
| `COPY_DB` | — | Копировать БД перед чтением |
| `FULL_SCAN` | — | Полный скан чатов |
| `CDP_PORT` | `9226` | Remote debugging |
| `CDP_URL` | — | Полный URL CDP |
| `CDP_WINDOW_TITLE` | — | Подстрока заголовка окна |
| `MSG_CACHE_TTL_MS` | `800` | TTL кэша сообщений |
| `CR_SEND_STRICT` | `1` | `0` — send без 409 при failed switch (UI confirm) |

## API

| Метод | Описание |
|-------|----------|
| `GET /api/cursor/snapshot?composerId=` | Canonical: чаты, CDP, agent |
| `GET /api/chats`, `/api/chats/:id?fresh=1` | Список / детали чата |
| `POST /api/send` | `{ "text", "composerId?", "windowTitle?" }` |
| `GET /api/agent` | Legacy (deprecated) |
| `GET /api/cdp/agent` | Legacy (deprecated) |

## Fixtures

```bash
npm run fixture:record
npm run fixture:record -- --apply
```

Два прогона `--apply`: агент idle, затем busy (агент работает) — для точных `composer-busy.json`.

## Тесты

```bash
npm test
npm run test:e2e
```

Фронт: `src/ui/` (Store, CrApi, PollScheduler), сборка `public/bundle.js`. CDP: `FixtureCdp` / `CursorMock`.
