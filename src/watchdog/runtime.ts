import type { CdpPort } from '../cdp/port';
import { liveCdp } from '../cdp/live-cdp';
import { ChatStore } from '../chat-store';
import { CursorModel } from '../cursor/cursor-model';
import { CursorDbReader } from '../db/reader';
import { globalDbPath } from '../db/paths';

export interface WatchdogRuntime {
  cursor: CursorModel;
  cdp: CdpPort;
  close(): void;
}

export async function createWatchdogRuntime(opts?: { cdp?: CdpPort }): Promise<WatchdogRuntime> {
  const dbPath = process.env.CURSOR_DB || globalDbPath();
  const reader = CursorDbReader.fromPath(dbPath, { copy: process.env.COPY_DB === '1' });
  const fullScan = process.env.FULL_SCAN === '1';
  const store = new ChatStore(reader, dbPath, fullScan);
  if (!store.status().ready) {
    await store.refresh();
  } else {
    void store.refresh();
  }
  const cdp = opts?.cdp ?? liveCdp;
  const cursor = new CursorModel(store, cdp);
  return {
    cursor,
    cdp,
    close() {
      reader.close();
    },
  };
}
