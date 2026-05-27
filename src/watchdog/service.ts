import type { CdpPort } from '../cdp/port';
import { createWatchdogActions } from './actions';
import { startDaemon, type DaemonControl } from './daemon';
import { createWatchdogRuntime } from './runtime';
import { WatchdogStats } from './stats';

export interface WatchdogService {
  stats: WatchdogStats;
  daemon: DaemonControl;
  close(): void;
}

export async function startWatchdogService(opts?: {
  cdp?: CdpPort;
  pollMs?: number;
}): Promise<WatchdogService> {
  const pollMs = opts?.pollMs ?? (Number(process.env.CR_WATCHDOG_POLL_MS) || 4000);
  const rt = await createWatchdogRuntime({ cdp: opts?.cdp });
  const stats = new WatchdogStats();
  const actions = createWatchdogActions(rt.cdp, () => rt.cursor.drainSendQueue());
  const daemon = startDaemon({ actions, stats, pollMs });
  return {
    stats,
    daemon,
    close() {
      daemon.stop();
      rt.close();
    },
  };
}
