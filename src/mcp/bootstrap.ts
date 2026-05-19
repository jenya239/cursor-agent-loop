import { checkCdpAvailable, cdpBaseUrl } from '../cdp/client';
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

/** DB-only chat read — no CDP (MCP must stay fast and not crash on probe). */
function getChatFromStore(store: ChatStore, composerId: string, fresh = false) {
  if (!store.reader.getComposerData(composerId)) return null;
  const { summary, messages, agentBusy, agentStatus } = store.getChat(composerId, fresh);
  const busy = agentBusy;
  return {
    summary: summary ?? { composerId, name: 'Untitled' },
    composerId,
    messages,
    agent: {
      phase: busy ? ('busy' as const) : ('idle' as const),
      busy,
      dbBusy: busy,
      cdpBusy: false,
      cdpOk: false,
      dbStatus: agentStatus,
      at: Date.now(),
    },
  };
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
    getChat: async (id, fresh) => getChatFromStore(store, id, fresh),
    snapshot: (id, o) => cursor.snapshot(id, o),
    send: (text, o) => cursor.send(text, o),
    enqueueSend: (text, o) => cursor.enqueueSend(text, o),
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
    cdpStatus: async () => ({
      ok: await checkCdpAvailable(cdpBaseUrl()),
      url: cdpBaseUrl(),
    }),
    dbInfo: () => ({ path: store.dbPath }),
  };

  return {
    deps,
    close() {
      reader.close();
    },
  };
}
