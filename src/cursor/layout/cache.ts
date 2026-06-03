import type { CdpPort } from '../../cdp/port';
import { isFixtureCdp } from '../../cdp/fixture-cdp';
import { observeCursorLayout } from './observe';
import type { CursorLayoutSnapshot } from './types';

const TTL_MS = 8000;

let cache: { at: number; data: CursorLayoutSnapshot } | null = null;
let inflight: Promise<CursorLayoutSnapshot> | null = null;

export function resetLayoutCache(): void {
  cache = null;
  inflight = null;
}

export async function cachedLayoutSnapshot(cdp: CdpPort): Promise<CursorLayoutSnapshot> {
  if (isFixtureCdp(cdp)) return observeCursorLayout(cdp);
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = observeCursorLayout(cdp)
    .then((data) => {
      cache = { at: Date.now(), data };
      inflight = null;
      return data;
    })
    .catch((e) => {
      inflight = null;
      if (cache) return cache.data;
      throw e;
    });
  return inflight;
}
