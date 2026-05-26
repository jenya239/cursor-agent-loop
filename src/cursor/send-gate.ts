import type { AgentState } from '../agent-model';

export const SEND_SETTLE_MS = Number(process.env.CR_SEND_SETTLE_MS) || 4000;

export class SendGate {
  private readonly lastBusyAt = new Map<string, number>();

  noteAgentState(composerId: string | undefined, st: AgentState, now = Date.now()): void {
    if (!composerId) return;
    const busy =
      st.busy ||
      st.cdpBusy ||
      st.dbBusy ||
      st.dbStatus === 'generating' ||
      st.dbStatus === 'running';
    if (busy) this.lastBusyAt.set(composerId, now);
  }

  settled(composerId: string | undefined, now = Date.now()): boolean {
    if (!composerId) return true;
    const last = this.lastBusyAt.get(composerId);
    if (last == null) return true;
    return now - last >= SEND_SETTLE_MS;
  }

  canSend(st: AgentState, composerId?: string, now = Date.now()): boolean {
    this.noteAgentState(composerId, st, now);
    if (!st.cdpOk) return false;
    if (st.busy || st.cdpBusy || st.dbBusy) return false;
    if (st.dbStatus === 'generating' || st.dbStatus === 'running') return false;
    return this.settled(composerId, now);
  }
}
