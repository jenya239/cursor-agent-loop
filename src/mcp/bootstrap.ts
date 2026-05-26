import type { CdpPort } from '../cdp/port';
import { liveCdp } from '../cdp/live-cdp';
import { ChatStore } from '../chat-store';
import { CursorModel } from '../cursor/cursor-model';
import { CursorDbReader } from '../db/reader';
import { globalDbPath } from '../db/paths';
import type { CrMcpDeps } from './handlers';
import { startSendQueueDrain } from '../send-queue-drain';

export interface CrMcpRuntime {
  deps: CrMcpDeps;
  close(): void;
}

export async function createCrMcpRuntime(opts?: { cdp?: CdpPort }): Promise<CrMcpRuntime> {
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
  startSendQueueDrain(cursor);

  const deps: CrMcpDeps = {
    listChats: () => store.getChats(),
    getChatByToken: (token, fresh) => cursor.getChatByToken(token, fresh),
    snapshotByToken: (token, o) => cursor.snapshotByToken(token, o),
    send: (text, o) => cursor.send(text, o),
    enqueueSend: (text, o) => cursor.enqueueSend(text, o),
    registerAgentToken: (opts) => cursor.registerAgentToken(opts),
    resolveAgentToken: (token, composerId) => cursor.resolveAgentToken(token, composerId),
    listSendQueue: () => cursor.listSendQueue(),
    drainSendQueue: () => cursor.drainSendQueue(),
    refreshDb: async () => {
      await store.refresh();
      const st = store.status();
      return {
        ready: st.ready,
        count: st.count,
        loading: st.loading,
        partial: st.partial,
      };
    },
    cdpStatus: () => cdp.status(),
    sessionByToken: (token) => cursor.sessionByToken(token),
    session: (composerId) => cursor.session(composerId),
    dbInfo: () => ({ path: store.dbPath }),
  };

  return {
    deps,
    close() {
      reader.close();
    },
  };
}
