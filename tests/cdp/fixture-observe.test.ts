import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { observeWindows } from '../../src/watchdog/observe';

describe('observeWindows on fixture', () => {
  it('reads per-window model and supervisor role from target-pages', async () => {
    const w = await observeWindows(new FixtureCdp('idle'));
    const mlc = w.find((x) => x.windowTitle.includes('mlc'));
    expect(mlc?.agentRole).toBe('supervisor');
    expect(mlc?.model).toContain('opus');
    const cr = w.find((x) => /cr - cr/i.test(x.windowTitle));
    expect(cr?.agentRole).toBe('default');
  });

  it('slow scenario marks cr busy with slowCount', async () => {
    const w = await observeWindows(new FixtureCdp('slow'));
    const cr = w.find((x) => /cr - cr/i.test(x.windowTitle));
    expect(cr?.busy).toBe(true);
    expect(cr?.slowCount).toBe(1);
    expect(cr?.pairs.some((p) => p.slow)).toBe(true);
    const mlc = w.find((x) => x.windowTitle.includes('mlc'));
    expect(mlc?.busy).toBe(false);
  });
});

describe('FixtureCdp.setComposerModel', () => {
  it('updates model and role heuristic', () => {
    const cdp = new FixtureCdp('idle');
    expect(cdp.setComposerModel('mlc', 'Composer 1')).toEqual({ ok: true, reason: 'set' });
    const bar = cdp.probeComposerBar('plan.md - mlc - Cursor');
    expect(bar.model).toBe('Composer 1');
    expect(bar.agentRole).toBe('default');
    cdp.setComposerModel('mlc', 'claude-opus-4');
    expect(cdp.probeComposerBar('plan.md - mlc - Cursor').agentRole).toBe('supervisor');
  });

  it('unknown window fails', () => {
    expect(new FixtureCdp('idle').setComposerModel('nope', 'x')).toEqual({
      ok: false,
      reason: 'window-not-found',
    });
  });
});
