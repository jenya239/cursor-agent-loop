import type { CursorDbReader } from './db/reader';
import { isAgentBusy } from './db/agent-state';

export type AgentPhase = 'idle' | 'busy' | 'unknown';

export interface AgentState {
  phase: AgentPhase;
  busy: boolean;
  dbBusy: boolean;
  cdpBusy: boolean;
  cdpOk: boolean;
  cdpReason?: string;
  cdpWindowTitle?: string;
  dbStatus?: string;
  composerId?: string;
  at: number;
}

export type CdpProbe = () => Promise<{ ok: boolean; busy: boolean; reason?: string; windowTitle?: string }>;

export class AgentModel {
  private cdpCache: {
    at: number;
    ok: boolean;
    busy: boolean;
    reason?: string;
    windowTitle?: string;
  } | null = null;

  constructor(
    private readonly reader: CursorDbReader,
    private readonly probeCdp: CdpProbe,
    private readonly cdpTtlMs = 400
  ) {}

  private async cdp(): Promise<{
    ok: boolean;
    busy: boolean;
    reason?: string;
    windowTitle?: string;
  }> {
    const hit = this.cdpCache;
    if (hit && Date.now() - hit.at < this.cdpTtlMs) {
      return hit;
    }
    try {
      const r = await this.probeCdp();
      this.cdpCache = { at: Date.now(), ...r };
      return r;
    } catch {
      const r = { ok: false, busy: false, reason: 'cdp-error' };
      this.cdpCache = { at: Date.now(), ...r };
      return r;
    }
  }

  dbState(composerId: string): { dbBusy: boolean; dbStatus?: string } {
    const data = this.reader.getComposerData(composerId);
    return { dbBusy: isAgentBusy(data), dbStatus: data?.status };
  }

  async forCdp(): Promise<AgentState> {
    const cdp = await this.cdp();
    const cdpBusy = cdp.ok && cdp.busy;
    return {
      phase: cdp.ok ? (cdpBusy ? 'busy' : 'idle') : 'unknown',
      busy: cdpBusy,
      dbBusy: false,
      cdpBusy,
      cdpOk: cdp.ok,
      cdpReason: cdp.reason,
      cdpWindowTitle: cdp.windowTitle,
      at: Date.now(),
    };
  }

  async forComposer(composerId: string): Promise<AgentState> {
    const { dbBusy, dbStatus } = this.dbState(composerId);
    const cdp = await this.cdp();
    const cdpBusy = cdp.ok && cdp.busy;
    const busy = dbBusy || cdpBusy;
    let phase: AgentPhase = 'unknown';
    if (cdp.ok || dbStatus === 'generating' || dbStatus === 'running') {
      phase = busy ? 'busy' : 'idle';
    } else if (dbBusy) {
      phase = 'busy';
    } else if (dbStatus === 'completed' || dbStatus === 'aborted') {
      phase = 'idle';
    }
    return {
      phase,
      busy,
      dbBusy,
      cdpBusy,
      cdpOk: cdp.ok,
      cdpReason: cdp.reason,
      cdpWindowTitle: cdp.windowTitle,
      dbStatus,
      composerId,
      at: Date.now(),
    };
  }
}
