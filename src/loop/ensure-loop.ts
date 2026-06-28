import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

const PIDFILE = path.join(os.homedir(), '.cursor', 'cursor-agent-loop.pid');

export function isLoopAlive(): boolean {
  try {
    const pid = Number(fs.readFileSync(PIDFILE, 'utf8').trim());
    if (!Number.isFinite(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function ensureLoopRunning(): { started: boolean } {
  if (isLoopAlive()) return { started: false };
  const script = path.join(__dirname, '../../scripts/ensure-loop.sh');
  spawn('bash', [script], { detached: true, stdio: 'ignore', env: process.env }).unref();
  return { started: true };
}
