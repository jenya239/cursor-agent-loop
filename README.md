# cr

Просмотр чатов Cursor из `state.vscdb` и отправка в активный composer через CDP.

```bash
npm install
npm run build:ui
npm run dev          # http://127.0.0.1:3847 — server + watch UI
```

Откройте **во внешнем** браузере (не вкладка Cursor). Нужны: `state.vscdb` (список и сообщения), Cursor с `--remote-debugging-port` (CDP, send, switch).

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PORT` | `3847` | HTTP порт |
| `CURSOR_DB` | auto | Путь к `state.vscdb` |
| `CURSOR_DB_CANDIDATES` | — | Пути через запятую (подсказка в UI) |
| `COPY_DB` | — | Копировать БД перед чтением |
| `FULL_SCAN` | `1` если индекс пуст | Полный скан чатов |
| `CDP_PORT` | `9226` | Remote debugging |
| `CDP_URL` | — | Полный URL CDP |
| `CDP_WINDOW_TITLE` | — | Подстрока заголовка окна |
| `MSG_CACHE_TTL_MS` | `800` | TTL кэша сообщений |
| `CR_SEND_STRICT` | `1` | `0` — send без 409 при failed switch (UI confirm) |
| `SNAPSHOT_SSE_MS` | `800` | Интервал SSE `/api/cursor/events` |

## API

| Метод | Описание |
|-------|----------|
| `GET /api/chats` | **Список чатов из БД** (основной источник для UI) |
| `GET /api/chats/:id?fresh=1` | Сообщения чата из БД |
| `GET /api/status` | Состояние индекса БД (`loading`, `partial`) |
| `POST /api/refresh` | Пересканировать БД |
| `GET /api/cursor/snapshot?composerId=` | CDP, agent, switch (без `chats` по умолчанию) |
| `GET /api/cursor/snapshot?includeChats=1` | Совместимость: snapshot + список из БД |
| `GET /api/cursor/events?composerId=` | SSE: live snapshot (CDP/agent) |
| `GET /api/db` | Текущий путь к БД |
| `POST /api/send` | `{ "text", "composerId?", "windowTitle?" }` |

## Switch composer

1. **v1 (DOM):** `data-composer-id`, history по имени, active tab.
2. **v2 (fallback):** Cmd/Ctrl+P + имя/uuid — только если v1 вернул `no-element` (может открыть не тот пункт палитры).

Если switch не сработал:

- Откройте нужный чат в Cursor вручную.
- В панели агента: «копировать id» (`composerId`).
- `CR_SEND_STRICT=0` — отправка с confirm в UI вместо HTTP 409.

Исследование DOM:

```bash
npm run probe:dump
npm run fixture:record -- --apply
```

## Fixtures

```bash
npm run fixture:record
npm run fixture:record -- --apply
npm run probe:dump
```

## Тесты

```bash
npm test
npm run test:e2e
```

Фронт: `src/ui/` → `public/bundle.js`. Список — `/api/chats`, live — snapshot/SSE.
