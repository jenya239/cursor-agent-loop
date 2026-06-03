import { hasSlowIndicator } from '../../src/watchdog/slow-recover';
import { SLOW_LABEL } from '../../src/cdp/composer-stuck';

describe('composer-stuck', () => {
  it('SLOW_LABEL matches Cursor UI copy', () => {
    expect(SLOW_LABEL).toBe('Taking longer than expected\u2026');
  });

  it('hasSlowIndicator detects pair.slow without global slowCount', () => {
    expect(
      hasSlowIndicator({
        windowTitle: 'mlc',
        composerId: 'x',
        model: '',
        agentRole: 'default',
        busy: true,
        slowCount: 0,
        reconnecting: false,
        draftLen: 0,
        draftHasToken: false,
        pairs: [{ preview: 'AGENT_TOKEN=', slow: true }],
      })
    ).toBe(true);
  });
});
