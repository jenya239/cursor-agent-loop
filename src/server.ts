import express from 'express';
import path from 'path';
import { CursorDbReader } from './db/reader';
import { globalDbPath } from './db/paths';
import { ChatStore } from './chat-store';
import { checkCdpAvailable, cdpBaseUrl } from './cdp/client';
import { CursorModel } from './cursor/cursor-model';
import type { CdpPort } from './cdp/port';
import { liveCdp } from './cdp/live-cdp';
import { sendComposerMessage } from './cdp/send';

export type SendHandler = (text: string) => Promise<{ ok: true; text: string }>;

export function createApp(
  store: ChatStore,
  opts?: { send?: SendHandler; cdp?: CdpPort; cursor?: CursorModel }
): express.Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  const send = opts?.send ?? (async (text: string) => {
    const r = await sendComposerMessage(text);
    return { ok: true, text: r.text };
  });
  const cursor = opts?.cursor ?? new CursorModel(store, opts?.cdp ?? liveCdp);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/cdp/status', async (_req, res) => {
    const url = cdpBaseUrl();
    res.json({ ok: await checkCdpAvailable(url), url });
  });

  app.get('/api/cursor/snapshot', async (req, res) => {
    const composerId =
      typeof req.query.composerId === 'string' ? req.query.composerId : undefined;
    res.json(await cursor.snapshot(composerId));
  });

  app.get('/api/cdp/agent', async (_req, res) => {
    const st = await cursor.agentState();
    res.json({ ok: st.cdpOk, busy: st.cdpBusy, agent: st });
  });

  app.get('/api/agent', async (req, res) => {
    const composerId = typeof req.query.composerId === 'string' ? req.query.composerId : '';
    if (!composerId) {
      res.json(await cursor.agentState());
      return;
    }
    if (!store.reader.getComposerData(composerId)) {
      res.status(404).json({ error: 'chat not found' });
      return;
    }
    res.json(await cursor.agentState(composerId));
  });

  let sendBusy = false;
  let lastServerSend = { text: '', at: 0 };

  app.post('/api/send', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const trimmed = text.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'text required' });
      return;
    }
    const now = Date.now();
    if (sendBusy) {
      res.status(429).json({ error: 'send in progress' });
      return;
    }
    if (trimmed === lastServerSend.text && now - lastServerSend.at < 8000) {
      res.status(429).json({ error: 'duplicate send' });
      return;
    }
    sendBusy = true;
    lastServerSend = { text: trimmed, at: now };
    try {
      const result = await send(trimmed);
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(502).json({ error: msg });
    } finally {
      setTimeout(() => {
        sendBusy = false;
      }, 1200);
    }
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

  app.get('/api/chats/:id', async (req, res) => {
    const composerId = req.params.id;
    const data = store.reader.getComposerData(composerId);
    if (!data) {
      res.status(404).json({ error: 'chat not found' });
      return;
    }
    const fresh = req.query.fresh === '1';
    const { summary, messages } = store.getChat(composerId, fresh);
    const agent = await cursor.agentState(composerId);
    res.json({
      ...summary,
      composerId,
      messages,
      agent,
      agentBusy: agent.busy,
      agentBusyDb: agent.dbBusy,
      agentStatus: agent.dbStatus,
    });
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
