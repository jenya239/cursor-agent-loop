import type { CursorSnapshot } from '../../cursor/types';

export type SnapshotHandler = (
  snap: CursorSnapshot,
  agentEvent: 'agent:busy' | 'agent:idle' | null
) => void;

export interface SnapshotStream {
  close(): void;
}

export function openSnapshotStream(
  composerId: string | null,
  onSnap: SnapshotHandler,
  onFallback: () => void
): SnapshotStream {
  if (typeof EventSource === 'undefined') {
    onFallback();
    return { close() {} };
  }
  const params = new URLSearchParams();
  if (composerId) params.set('composerId', composerId);
  const es = new EventSource(`/api/cursor/events?${params}`);
  let prevBusy: boolean | null = null;
  es.onmessage = (ev) => {
    try {
      const snap = JSON.parse(ev.data) as CursorSnapshot;
      const busy = snap.agent.busy;
      const agentEvent =
        prevBusy === null ? null : busy !== prevBusy ? (busy ? 'agent:busy' : 'agent:idle') : null;
      prevBusy = busy;
      onSnap(snap, agentEvent);
    } catch {
      /* ignore */
    }
  };
  es.onerror = () => {
    es.close();
    onFallback();
  };
  return {
    close() {
      es.close();
    },
  };
}
