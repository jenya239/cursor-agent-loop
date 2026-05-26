import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { runComposerSend } from '../../src/cdp/composer-send';

describe('runComposerSend via CdpPort', () => {
  it('delegates to fixture sendMessage', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await runComposerSend(cdp, 'hi', { windowTitle: 'mlc' });
    expect(r.pageTitle).toMatch(/mlc/);
    expect(r.text).toBe('hi');
  });

  it('calls dismissModals before send', async () => {
    const cdp = new FixtureCdp('modal-revert');
    const dismiss = jest.spyOn(cdp, 'dismissModals');
    await runComposerSend(cdp, 'x');
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('draft-stuck via runComposerSend after clearComposerDraft', async () => {
    const cdp = new FixtureCdp('draft-stuck');
    await expect(runComposerSend(cdp, 'x')).rejects.toThrow(/not empty/);
    cdp.clearComposerDraft();
    const r = await runComposerSend(cdp, 'ok');
    expect(r.text).toBe('ok');
  });
});
