import { FixtureCdp } from '../../../src/cdp/fixture-cdp';
import { cachedLayoutSnapshot, resetLayoutCache } from '../../../src/cursor/layout/cache';

describe('cachedLayoutSnapshot', () => {
  afterEach(() => resetLayoutCache());

  it('returns fixture immediately without cache for fixture cdp', async () => {
    const cdp = new FixtureCdp('idle');
    const a = await cachedLayoutSnapshot(cdp);
    expect(a.windows.length).toBe(4);
    const b = await cachedLayoutSnapshot(cdp);
    expect(b.windows.length).toBe(4);
  });
});
