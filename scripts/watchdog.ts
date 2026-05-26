#!/usr/bin/env npx tsx
import { spawn } from 'child_process';
import path from 'path';
import {
  defaultPidPath,
  defaultSockPath,
  isProcessAlive,
  readPidFile,
} from '../src/watchdog/paths';
import { watchdogRequest } from '../src/watchdog/client';

const cmd = process.argv[2];

function resolveConn() {
  const pf = readPidFile();
  const sock = process.env.WATCHDOG_SOCK || pf?.sock || defaultSockPath();
  const port = pf?.port ?? (process.env.WATCHDOG_PORT ? Number(process.env.WATCHDOG_PORT) : undefined);
  return { sock: port ? undefined : sock, port, pf };
}

async function api(method: string, urlPath: string) {
  const { sock, port } = resolveConn();
  return watchdogRequest(method, urlPath, { sock, port });
}

async function start() {
  const pf = readPidFile();
  if (pf?.pid && isProcessAlive(pf.pid)) {
    console.log(JSON.stringify({ ok: true, already: true, pid: pf.pid }));
    return;
  }
  const entry = path.join(__dirname, '../src/watchdog/index.ts');
  const child = spawn('npx', ['tsx', entry], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const p = readPidFile();
    if (p?.pid && isProcessAlive(p.pid)) {
      console.log(JSON.stringify({ ok: true, pid: p.pid, sock: p.sock, port: p.port }));
      return;
    }
  }
  console.error('watchdog failed to start');
  process.exit(1);
}

async function stop() {
  const r = await api('DELETE', '/stop');
  console.log(r.body);
  if (r.status >= 400) process.exit(1);
}

async function status() {
  const r = await api('GET', '/status');
  console.log(r.body);
  if (r.status >= 400) process.exit(1);
}

async function stats() {
  const r = await api('GET', '/stats');
  console.log(JSON.stringify(JSON.parse(r.body), null, 2));
  if (r.status >= 400) process.exit(1);
}

async function logs() {
  const r = await api('GET', '/log');
  const j = JSON.parse(r.body) as { events: unknown[] };
  for (const e of j.events) console.log(JSON.stringify(e));
  if (r.status >= 400) process.exit(1);
}

async function main() {
  switch (cmd) {
    case 'start':
      await start();
      break;
    case 'stop':
      await stop();
      break;
    case 'status':
      await status();
      break;
    case 'stats':
      await stats();
      break;
    case 'logs':
      await logs();
      break;
    default:
      console.error('usage: watchdog.ts start|stop|status|stats|logs');
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
