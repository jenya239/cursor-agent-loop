import type { WatchdogActions, DismissOutcome } from '../../src/watchdog/actions';
import { runDismissOnPage } from '../../src/watchdog/actions';

describe('runDismissOnPage', () => {
  it('returns empty when no modal', async () => {
    const evalJs = jest.fn().mockResolvedValue({ result: { value: { open: false } } });
    const out = await runDismissOnPage(evalJs, 'win');
    expect(out).toEqual([]);
    expect(evalJs).toHaveBeenCalledTimes(2);
  });

  it('records pretty_dialog dismiss', async () => {
    const evalJs = jest
      .fn()
      .mockResolvedValueOnce({ result: { value: { open: true, action: 'dont-revert', btn: "Don't revert" } } })
      .mockResolvedValueOnce({ result: { value: { open: false } } });
    const out = await runDismissOnPage(evalJs, 'mlc');
    expect(out).toEqual([
      { kind: 'pretty_dialog', open: true, action: 'dont-revert', btn: "Don't revert", windowTitle: 'mlc' },
    ]);
  });
});

describe('WatchdogActions mock', () => {
  it('drainQueue interface', async () => {
    const actions: WatchdogActions = {
      dismissModals: async () => [] as DismissOutcome[],
      drainQueue: async () => ({ sent: 2, remaining: 1 }),
    };
    expect(await actions.drainQueue()).toEqual({ sent: 2, remaining: 1 });
  });
});
