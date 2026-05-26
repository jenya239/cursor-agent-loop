import fs from 'fs';
import http from 'http';
import { createWatchdogApp } from './http-api';
import { startDaemon } from './daemon';
import { WatchdogStats } from './stats';
import { createWatchdogActions } from './actions';
import { liveCdp } from '../cdp/live-cdp';
import { defaultPidPath, defaultSockPath, removePidFile, writePidFile } from './paths';

async function drainViaCrServer(): Promise<{ sent: number; remaining: number }> {
  const base = process.env.CR_SERVER_URL || 'http://127.0.0.1:3847';
  try {
    const res = await fetch(`${base}/api/send/flush`, { method: 'POST' });
    if (!res.ok) return { sent: 0, remaining: 0 };
    const j = (await res.json()) as { sent?: number; remaining?: number };
    return { sent: j.sent ?? 0, remaining: j.remaining ?? 0 };
  } catch {
    return { sent: 0, remaining: 0 };
  }
}

export async function runWatchdogDaemon(): Promise<void> {
  const sock = defaultSockPath();
  const port = process.env.WATCHDOG_PORT ? Number(process.env.WATCHDOG_PORT) : undefined;
  const pollMs = Number(process.env.CR_WATCHDOG_POLL_MS) || 4000;

  if (!port && fs.existsSync(sock)) {
    try {
      fs.unlinkSync(sock);
    } catch {
      /* stale or in use */
    }
  }

  const stats = new WatchdogStats();
  const actions = createWatchdogActions(liveCdp, drainViaCrServer);

  let server!: http.Server;
  const daemon = startDaemon({ actions, stats, pollMs });

  const shutdown = () => {
    daemon.stop();
    removePidFile();
    if (!port && fs.existsSync(sock)) {
      try {
        fs.unlinkSync(sock);
      } catch {
        /* ignore */
      }
    }
    server?.close(() => process.exit(0));
  };

  const app = createWatchdogApp({
    stats,
    daemon,
    pid: process.pid,
    sock: port ? undefined : sock,
    port,
    onStop: shutdown,
  });

  server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    if (port) {
      server.listen(port, '127.0.0.1', () => resolve());
    } else {
      server.listen(sock, () => resolve());
    }
    server.on('error', reject);
  });

  writePidFile({
    pid: process.pid,
    sock: port ? undefined : sock,
    port,
    startedAt: new Date().toISOString(),
  });

  process.stderr.write(
    `[watchdog] pid=${process.pid} ${port ? `port=${port}` : `sock=${sock}`} poll=${pollMs}ms\n`
  );

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  runWatchdogDaemon().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
