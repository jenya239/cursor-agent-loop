import { watchdogRequest } from './client';
import { defaultSockPath, readPidFile } from './paths';

export async function fetchWatchdogStats(): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const pf = readPidFile();
    const port = pf?.port ?? (process.env.WATCHDOG_PORT ? Number(process.env.WATCHDOG_PORT) : undefined);
    const sock = process.env.WATCHDOG_SOCK || pf?.sock || defaultSockPath();
    const r = await watchdogRequest('GET', '/stats', { sock: port ? undefined : sock, port });
    if (r.status >= 400) return { ok: false, error: `watchdog ${r.status}` };
    return { ok: true, data: JSON.parse(r.body) as unknown };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
