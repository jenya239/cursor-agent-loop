import {
  FixtureCdp,
  FIXTURE_ACTIVE_COMPOSER,
  FIXTURE_MLC_COMPOSER,
} from '../../src/cdp/fixture-cdp';

describe('CdpPort extended (fixture)', () => {
  it('probeActive returns active composer', async () => {
    const cdp = new FixtureCdp('idle');
    const a = await cdp.probeActive();
    expect(a?.composerId).toBe(FIXTURE_ACTIVE_COMPOSER);
    expect(a?.windowTitle).toMatch(/cr - cr/);
  });

  it('findWindowForComposer matches mlc window', async () => {
    const cdp = new FixtureCdp('idle');
    const w = await cdp.findWindowForComposer(FIXTURE_MLC_COMPOSER, { workspaceHints: ['mlc'] });
    expect(w?.composerId).toBe(FIXTURE_MLC_COMPOSER);
    expect(w?.windowTitle).toMatch(/mlc/);
  });

  it('dismissModals modal-revert dismisses once', async () => {
    const cdp = new FixtureCdp('modal-revert');
    const first = await cdp.dismissModals();
    expect(first).toHaveLength(1);
    expect(first[0].kind).toBe('pretty_dialog');
    expect(first[0].open).toBe(true);
    expect(await cdp.dismissModals()).toEqual([]);
  });

  it('dismissModals idle returns empty', async () => {
    const cdp = new FixtureCdp('idle');
    expect(await cdp.dismissModals()).toEqual([]);
  });
});
