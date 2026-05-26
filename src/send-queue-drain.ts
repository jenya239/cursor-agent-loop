import type { CursorModel } from './cursor/cursor-model';

export function startSendQueueDrain(model: CursorModel, intervalMs = 2000): () => void {
  const debug = process.env.CR_QUEUE_DEBUG === '1';
  const id = setInterval(() => {
    void model.drainSendQueue().then((r) => {
      if (debug && (r.sent > 0 || r.remaining > 0)) {
        process.stderr.write(`[cr-queue] drain sent=${r.sent} remaining=${r.remaining}\n`);
      }
    }).catch((e) => {
      if (debug) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`[cr-queue] drain error: ${msg}\n`);
      }
    });
  }, intervalMs);
  if (debug) process.stderr.write(`[cr-queue] drain interval ${intervalMs}ms\n`);
  return () => clearInterval(id);
}
