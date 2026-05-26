import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { runDismissOnPage } from '../../src/cdp/dismiss-modals';
import { createWatchdogActions } from '../../src/watchdog/actions';

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

describe('createWatchdogActions', () => {
  it('uses CdpPort.dismissModals', async () => {
    const cdp = new FixtureCdp('modal-revert');
    const actions = createWatchdogActions(cdp, async () => ({ sent: 0, remaining: 0 }));
    const out = await actions.dismissModals();
    expect(out).toHaveLength(1);
    expect(await actions.drainQueue()).toEqual({ sent: 0, remaining: 0 });
  });
});
