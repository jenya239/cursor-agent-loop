import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { COMPOSER_AGENT_PROBE_ID } from '../../src/cdp/port';

describe('FixtureCdp scenarios', () => {
  it('no-bar probe', async () => {
    const cdp = new FixtureCdp('no-bar');
    const p = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
    expect(p[0].reason).toBe('no-bar');
  });

  it('send-blocked throws', async () => {
    const cdp = new FixtureCdp('send-blocked');
    await expect(cdp.sendMessage('x')).rejects.toThrow(/агент/);
  });
});
