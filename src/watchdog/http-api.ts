import express from 'express';
import type { WatchdogStats } from './stats';
import type { DaemonControl } from './daemon';

export interface WatchdogAppOpts {
  stats: WatchdogStats;
  daemon: DaemonControl;
  pid: number;
  sock?: string;
  port?: number;
  onStop?: () => void;
}

export function createWatchdogApp(opts: WatchdogAppOpts): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/status', (_req, res) => {
    res.json({
      alive: true,
      uptime_ms: opts.stats.snapshot().uptime_ms,
      pid: opts.pid,
      sock: opts.sock ?? null,
      port: opts.port ?? null,
    });
  });

  app.get('/stats', (_req, res) => {
    res.json(opts.stats.snapshot());
  });

  app.get('/log', (_req, res) => {
    res.json({ events: opts.stats.events() });
  });

  app.get('/', (_req, res) => {
    res.type('html').send(panelHtml());
  });

  app.post('/dismiss', (_req, res) => {
    void opts.daemon.tick().then(() => res.json({ ok: true }));
  });

  app.post('/pause', (_req, res) => {
    opts.daemon.pause();
    res.json({ ok: true, paused: true });
  });

  app.post('/resume', (_req, res) => {
    opts.daemon.resume();
    res.json({ ok: true, paused: false });
  });

  app.delete('/stop', (_req, res) => {
    opts.daemon.stop();
    opts.onStop?.();
    res.json({ ok: true, stopping: true });
  });

  return app;
}

function panelHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>cr-watchdog</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#111;color:#ddd}
h1{font-size:18px;margin:0 0 12px}
pre{background:#222;padding:12px;border-radius:6px;overflow:auto}
button{margin-right:8px;padding:4px 10px}
</style></head><body>
<h1>cr-watchdog</h1>
<div id="status">loading�</div>
<pre id="stats"></pre>
<button onclick="fetch('/pause',{method:'POST'}).then(refresh)">pause</button>
<button onclick="fetch('/resume',{method:'POST'}).then(refresh)">resume</button>
<button onclick="fetch('/dismiss',{method:'POST'}).then(refresh)">dismiss now</button>
<script>
async function refresh(){
  const s=await fetch('/status').then(r=>r.json());
  const st=await fetch('/stats').then(r=>r.json());
  document.getElementById('status').textContent='pid '+s.pid+' uptime '+st.uptime_ms+'ms paused='+st.paused;
  document.getElementById('stats').textContent=JSON.stringify(st,null,2);
}
refresh();setInterval(refresh,2000);
</script></body></html>`;
}
