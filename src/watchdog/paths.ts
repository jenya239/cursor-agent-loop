import fs from 'fs';
import os from 'os';
import path from 'path';

export interface PidFile {
  pid: number;
  sock?: string;
  port?: number;
  startedAt: string;
}

export function cursorDir(): string {
  return path.join(os.homedir(), '.cursor');
}

export function defaultSockPath(): string {
  return process.env.WATCHDOG_SOCK || path.join(cursorDir(), 'cr-watchdog.sock');
}

export function defaultPidPath(): string {
  return path.join(cursorDir(), 'cr-watchdog.pid');
}

export function writePidFile(data: PidFile, file = defaultPidPath()): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data)}\n`);
}

export function readPidFile(file = defaultPidPath()): PidFile | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PidFile;
  } catch {
    return null;
  }
}

export function removePidFile(file = defaultPidPath()): void {
  try {
    fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
