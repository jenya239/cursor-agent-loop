import express from 'express';
import path from 'path';
import { CursorDbReader } from './db/reader';
import { globalDbPath } from './db/paths';
import { ChatStore } from './chat-store';

export function createApp(store: ChatStore): express.Express {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/status', (_req, res) => {
    res.json(store.status());
  });

  app.get('/api/chats', (req, res) => {
    const { chats, partial } = store.getChats();
    const st = store.status();
    const ws = req.query.workspace as string | undefined;
    const filtered = ws
      ? chats.filter(
          (c) => c.workspaceId === ws || c.workspaceLabel === ws || c.workspacePath === ws
        )
      : chats;
    res.json({
      chats: filtered,
      partial,
      loading: st.loading,
      cachedAt: st.cachedAt,
    });
  });

  app.get('/api/workspaces', (_req, res) => {
    const { chats } = store.getChats();
    const byLabel = new Map<string, { label: string; path: string; id: string; count: number }>();
    for (const c of chats) {
      const label = c.workspaceLabel || '—';
      const key = c.workspaceId || label;
      const cur = byLabel.get(key);
      if (cur) cur.count++;
      else
        byLabel.set(key, {
          label,
          path: c.workspacePath || '',
          id: c.workspaceId || '',
          count: 1,
        });
    }
    res.json(
      [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
    );
  });

  app.post('/api/refresh', async (_req, res) => {
    await store.refresh();
    res.json(store.status());
  });

  app.get('/api/chats/:id', (req, res) => {
    const composerId = req.params.id;
    const data = store.reader.getComposerData(composerId);
    if (!data) {
      res.status(404).json({ error: 'chat not found' });
      return;
    }
    const fresh = req.query.fresh === '1';
    const { summary, messages } = store.getChat(composerId, fresh);
    res.json({ ...summary, composerId, messages });
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

function main(): void {
  const dbPath = process.env.CURSOR_DB || globalDbPath();
  const reader = CursorDbReader.fromPath(dbPath, { copy: process.env.COPY_DB === '1' });
  const fullScan = process.env.FULL_SCAN === '1';
  const store = new ChatStore(reader, dbPath, fullScan);

  const app = createApp(store);
  const port = Number(process.env.PORT) || 3847;

  const server = app.listen(port, () => {
    console.log(`http://127.0.0.1:${port}  db=${dbPath}`);
    store.warm();
  });

  const shutdown = () => {
    server.close();
    reader.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main();
}
