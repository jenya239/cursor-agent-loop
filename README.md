# cr

Просмотр чатов Cursor из `state.vscdb` и отправка в активный composer через CDP.

```bash
npm install
npm run dev          # http://127.0.0.1:3847
```

Cursor с remote debugging (`CDP_PORT`, по умолчанию 9226). Открывай UI во **внешнем** браузере, не во вкладке Cursor.

## API

- `GET /api/chats`, `/api/chats/:id`
- `GET /api/cursor/snapshot?composerId=`
- `GET /api/agent?composerId=`
- `POST /api/send` — `{ "text": "..." }`

## Fixtures

```bash
npm run fixture:record              # src/cdp/fixtures/recorded/
npm run fixture:record -- --apply   # обновить targets.default.json и composer-* 
```

Тесты: `npm test` (CDP через `FixtureCdp` / `CursorMock`).
