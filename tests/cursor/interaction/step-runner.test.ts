import { FixtureCdp } from '../../../src/cdp/fixture-cdp';
import { actions, expect as ixExpect, runStep, waitFor } from '../../../src/cursor/interaction';
import { captureSnapshot } from '../../../src/cursor/interaction/snapshot';

describe('runStep fixture', () => {
  it('noop + unchanged', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await runStep(cdp, {
      label: 'noop',
      windowTitle: 'cr - cr',
      action: actions.noop(),
      expect: ixExpect.unchanged(),
      wait: { timeoutMs: 800, intervalMs: 100 },
    });
    expect(r.ok).toBe(true);
    expect(r.verdict).toBe('unchanged');
  });

  it('stop + agentIdle on busy cr', async () => {
    const cdp = new FixtureCdp('busy');
    const before = await captureSnapshot(cdp, 'cr - cr');
    expect(before.agent.busy).toBe(true);
    const r = await runStep(cdp, {
      label: 'stop',
      windowTitle: 'cr - cr',
      action: actions.stop(),
      expect: ixExpect.agentIdle(),
      wait: { timeoutMs: 2000, intervalMs: 100 },
    });
    expect(r.ok).toBe(true);
    expect(r.verdict).toBe('finished');
    expect(r.after.agent.busy).toBe(false);
  });

  it('send blocked records action error', async () => {
    const cdp = new FixtureCdp('send-blocked');
    const r = await runStep(cdp, {
      windowTitle: 'cr - cr',
      action: actions.send('hi'),
      expect: ixExpect.agentStarted(),
      wait: { timeoutMs: 500, intervalMs: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.actionError).toContain('\u0430\u0433\u0435\u043d\u0442');
  });

  it('modal revert detected as blocked', async () => {
    const cdp = new FixtureCdp('modal-revert');
    const r = await waitFor(cdp, {
      windowTitle: 'cr - cr',
      expect: ixExpect.sendBlocked(),
      wait: { timeoutMs: 500, intervalMs: 50 },
    });
    expect(r.ok).toBe(true);
    expect(r.verdict).toBe('blocked');
  });

  it('dismiss clears modal-revert blocker', async () => {
    const cdp = new FixtureCdp('modal-revert');
    expect((await captureSnapshot(cdp, 'cr - cr')).blockers.sendBlocked).toBe(true);
    await cdp.dismissModals();
    expect((await captureSnapshot(cdp, 'cr - cr')).blockers.sendBlocked).toBe(false);
  });

  it('busy scenario shows activeTool in snapshot', async () => {
    const cdp = new FixtureCdp('busy');
    const s = await captureSnapshot(cdp, 'cr - cr');
    expect(s.thread.activeTool).toContain('Worked for');
  });
});

describe('stopAgent', () => {
  it('fixture returns no-stop when idle', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await cdp.stopAgent({ windowTitle: 'cr - cr' });
    expect(r.ok).toBe(false);
  });
});
