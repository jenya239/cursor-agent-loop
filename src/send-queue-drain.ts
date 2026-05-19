import type { CursorModel } from './cursor/cursor-model';

export function startSendQueueDrain(model: CursorModel, intervalMs = 1500): () => void {
  const id = setInterval(() => {
    void model.drainSendQueue().catch(() => {});
  }, intervalMs);
  return () => clearInterval(id);
}
