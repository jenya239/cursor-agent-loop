import express from 'express';
import path from 'path';
import { CursorDbReader } from './db/reader';
import { globalDbPath } from './db/paths';
import { ChatStore } from './chat-store';
import { CursorModel } from './cursor/cursor-model';
import type { CdpPort } from './cdp/port';
import { liveCdp } from './cdp/live-cdp';
import { scheduleSendRelease } from './send-guard';
import { startSendQueueDrain } from './send-queue-drain';
import { isAgentBusySendError } from './send-queue';
import { analyzeSupervisor, loadSupervisorReport } from './supervisor/analyze';
import type { WatchdogStats } from './watchdog/stats';
import { fetchWatchdogStats } from './watchdog/proxy';
import { maxUsagePct, probeWindowUsage } from './cursor/probe-usage';
import { getAgentState, refreshAgentStates } from './cursor/agent-state';
import { resolveTargets } from './cursor/agent-targets';
import type { ChatLine } from './cursor/loop-guard';
import { listCostEntries } from './db/cost-entries';
import { buildProgressReport } from './progress/report';
import { AGENT_TARGETS } from './cursor/agent-targets';
import { startMeetingsWatcher } from './meetings/sync';
import { startSessionTurnsWatcher } from './session/sync';
import { startTurnLogWatcher } from './session/sync-turnlog';
import { captureSnapshot } from './cursor/interaction/snapshot';
import { runStep, waitFor, stepRequestToOpts, waitRequestToOpts } from './cursor/interaction';
import type { StepRequest, WaitRequest } from './cursor/interaction/registry';

export type SendHandler = (
  text: string,
  token: string,
  windowTitle?: string
) => Promise<{ ok: true; text: string; pageTitle?: string }>;

export function createApp(
  store: ChatStore,
  opts?: {
    send?: SendHandler;
    cdp?: CdpPort;
    cursor?: CursorModel;
    sendQueueDrain?: boolean;
    watchdogStats?: WatchdogStats | null;
  }
): express.Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  const cdp = opts?.cdp ?? liveCdp;
  const cursor = opts?.cursor ?? new CursorModel(store, cdp);
  if (opts?.sendQueueDrain !== false) {
    startSendQueueDrain(cursor);
  }
  const send =
    opts?.send ??
    (async (text: string, token: string, windowTitle?: string) => {
      const r = await cursor.send(text, { token, windowTitle });
      return { ok: true, text: r.text, pageTitle: r.pageTitle };
    });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/cdp/status', async (_req, res) => {
    res.json(await cdp.status());
  });

  app.get('/api/watchdog/stats', async (_req, res) => {
    let data: Record<string, unknown> | null = null;
    if (opts?.watchdogStats) {
      data = opts.watchdogStats.snapshot() as unknown as Record<string, unknown>;
    } else if (opts?.watchdogStats === null) {
      res.status(503).json({ error: 'watchdog disabled' });
      return;
    } else {
      const r = await fetchWatchdogStats();
      if (!r.ok) {
        res.status(503).json({ error: r.error });
        return;
      }
      data = r.data as Record<string, unknown>;
    }
    try {
      const usage = await probeWindowUsage(cdp);
      const windows = (data.windows as Array<Record<string, unknown>>) || [];
      data.usageMax = maxUsagePct(usage);
      data.windows = windows.map((w) => {
        const u = usage.find(
          (x) => x.composerId === w.composerId || (x.windowTitle && x.windowTitle === w.windowTitle)
        );
        return {
          ...w,
          usagePct: u?.usagePct ?? null,
          reconnecting: w.reconnecting === true || u?.reconnecting === true,
        };
      });
    } catch {
      data.usageMax = null;
    }
    res.json(data);
  });

  app.get('/api/supervisor/alerts', (_req, res) => {
    res.json(analyzeSupervisor());
  });

  app.get('/api/supervisor/state', (_req, res) => {
    const cached = loadSupervisorReport();
    res.json(cached ?? analyzeSupervisor());
  });

  app.get('/api/agent/state', async (req, res) => {
    const targetId = typeof req.query.target === 'string' ? req.query.target.trim() : undefined;
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    try {
      if (refresh) {
        const usageWindows = await probeWindowUsage(cdp);
        const targets = targetId ? resolveTargets().filter((t) => t.id === targetId) : resolveTargets();
        const messages = new Map<string, ChatLine[]>();
        for (const t of targets) {
          messages.set(t.composerId, store.getChat(t.composerId, true).messages);
        }
        refreshAgentStates(targets, messages, usageWindows);
      }
      res.json(getAgentState(targetId));
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/session', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const composerId =
      typeof req.query.composerId === 'string' ? req.query.composerId : undefined;
    try {
      if (token) {
        res.json(await cursor.sessionByToken(token));
        return;
      }
      if (composerId) {
        res.json(await cursor.session(composerId));
        return;
      }
      res.status(400).json({ error: 'token or composerId required' });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/cursor/layout', async (_req, res) => {
    try {
      res.json(await cursor.layoutSnapshot());
    } catch (e) {
      res.status(503).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/cursor/interact/snapshot', async (req, res) => {
    const windowTitle =
      typeof req.query.windowTitle === 'string' ? req.query.windowTitle : undefined;
    try {
      res.json(await captureSnapshot(cdp, windowTitle));
    } catch (e) {
      res.status(503).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post('/api/cursor/interact/wait', async (req, res) => {
    const body = req.body as WaitRequest;
    if (!body?.expect) {
      res.status(400).json({ error: 'expect required' });
      return;
    }
    try {
      res.json(await waitFor(cdp, waitRequestToOpts(body)));
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post('/api/cursor/interact/step', async (req, res) => {
    const body = req.body as StepRequest;
    if (!body?.action) {
      res.status(400).json({ error: 'action required' });
      return;
    }
    try {
      res.json(await runStep(cdp, stepRequestToOpts(body)));
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/cursor/snapshot', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const composerId =
      typeof req.query.composerId === 'string' ? req.query.composerId : undefined;
    const includeChats =
      req.query.includeChats === '1' || req.query.includeChats === 'true';
    try {
      if (token) {
        res.json(await cursor.snapshotByToken(token, { includeChats }));
        return;
      }
      res.json(await cursor.snapshot(composerId, { includeChats }));
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/db', (_req, res) => {
    const candidates = (process.env.CURSOR_DB_CANDIDATES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    res.json({ path: store.dbPath, candidates });
  });

  const sseMs = Number(process.env.SNAPSHOT_SSE_MS) || 800;
  app.get('/api/cursor/events', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const composerId =
      typeof req.query.composerId === 'string' ? req.query.composerId : undefined;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    let closed = false;
    req.on('close', () => {
      closed = true;
    });
    const push = async () => {
      if (closed) return;
      try {
        const snap = token
          ? await cursor.snapshotByToken(token)
          : await cursor.snapshot(composerId);
        res.write(`data: ${JSON.stringify(snap)}\n\n`);
      } catch {
        /* skip tick */
      }
      if (!closed) setTimeout(push, sseMs);
    };
    void push();
  });

  let sendBusy = false;
  let lastServerSend = { text: '', at: 0 };

  app.post('/api/send', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const windowTitle =
      typeof req.body?.windowTitle === 'string' ? req.body.windowTitle : undefined;
    const queue = req.body?.queue === true || req.body?.queue === 'true';
    const trimmed = text.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'text required' });
      return;
    }
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    if (queue) {
      try {
        const item = await cursor.enqueueSend(trimmed, { token, windowTitle });
        res.status(202).json({
          ok: true,
          queued: true,
          native: item.native === true,
          id: item.id,
          position: item.position,
        });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
      }
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
      const result = await send(trimmed, token, windowTitle);
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (req.body?.queueOnBusy && isAgentBusySendError(msg)) {
        const item = await cursor.enqueueSend(trimmed, { token, windowTitle });
        res.status(202).json({
          ok: true,
          queued: true,
          native: item.native === true,
          id: item.id,
          position: item.position,
        });
        return;
      }
      const code = msg.includes('switch failed') ? 409 : 502;
      res.status(code).json({ error: msg });
    } finally {
      scheduleSendRelease(() => {
        sendBusy = false;
      }, 1200);
    }
  });

  app.get('/api/send/queue', (_req, res) => {
    res.json({ items: cursor.listSendQueue() });
  });

  app.post('/api/send/queue', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const windowTitle =
      typeof req.body?.windowTitle === 'string' ? req.body.windowTitle : undefined;
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    try {
      const item = await cursor.enqueueSend(text, { token, windowTitle });
      res.status(202).json({
        ok: true,
        queued: true,
        native: item.native === true,
        id: item.id,
        position: item.position,
      });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post('/api/send/flush', async (req, res) => {
    const composerId =
      typeof req.query.composerId === 'string' ? req.query.composerId.trim() : undefined;
    res.json(await cursor.drainSendQueue(composerId || undefined));
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
    const fresh = req.query.fresh === '1';
    const view = await cursor.chat(composerId, fresh);
    if (!view) {
      res.status(404).json({ error: 'chat not found' });
      return;
    }
    const { agent, messages, summary } = view;
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

  app.get('/api/progress', (_req, res) => {
    try {
      res.json(buildProgressReport());
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/billing', (req, res) => {
    try {
      const parsed = Number.parseInt(String(req.query.limit ?? '100'), 10);
      const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
      res.json({ entries: listCostEntries({ limit }) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

function main(): void {
  void (async () => {
    const dbPath = process.env.CURSOR_DB || globalDbPath();
    const reader = CursorDbReader.fromPath(dbPath, { copy: process.env.COPY_DB === '1' });
    const fullScan = process.env.FULL_SCAN === '1';
    const store = new ChatStore(reader, dbPath, fullScan);

    let watchdogSvc: Awaited<ReturnType<typeof import('./watchdog/service').startWatchdogService>> | undefined;
    if (process.env.CR_WATCHDOG !== '0') {
      const { startWatchdogService } = await import('./watchdog/service');
      watchdogSvc = await startWatchdogService();
      process.stderr.write('[cr] watchdog in-process\n');
    }

    const app = createApp(store, { watchdogStats: watchdogSvc?.stats ?? null });
    const port = Number(process.env.PORT) || 3847;
    const primaryAgent = AGENT_TARGETS.find((target) => target.id === 'mlc') ?? AGENT_TARGETS[0];
    const sessionWatcher = primaryAgent
      ? startSessionTurnsWatcher(primaryAgent.agentDir)
      : undefined;
    const turnLogWatcher = primaryAgent
      ? startTurnLogWatcher(primaryAgent.agentDir)
      : undefined;
    const meetingsWatcher = primaryAgent
      ? startMeetingsWatcher(path.join(primaryAgent.agentDir, 'meetings'))
      : undefined;

    const server = app.listen(port, () => {
      console.log(`http://127.0.0.1:${port}  db=${dbPath}`);
      store.warm();
    });

    const shutdown = () => {
      sessionWatcher?.stop();
      turnLogWatcher?.stop();
      meetingsWatcher?.stop();
      watchdogSvc?.close();
      server.close();
      reader.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}
