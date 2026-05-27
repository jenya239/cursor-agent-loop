import fs from 'fs';
import http from 'http';
import { createWatchdogApp } from './http-api';
import { startWatchdogService } from './service';
import { defaultSockPath, removePidFile, writePidFile } from './paths';

export async function runWatchdogDaemon(): Promise<void> {
  const sock = defaultSockPath();
  const port = process.env.WATCHDOG_PORT ? Number(process.env.WATCHDOG_PORT) : undefined;

  if (!port && fs.existsSync(sock)) {
    try {
      fs.unlinkSync(sock);
    } catch {
      /* stale or in use */
    }
  }

  const svc = await startWatchdogService();

  let server!: http.Server;
  const shutdown = () => {
    svc.close();
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
    stats: svc.stats,
    daemon: svc.daemon,
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
    `[watchdog] pid=${process.pid} ${port ? `port=${port}` : `sock=${sock}`} standalone\n`
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
