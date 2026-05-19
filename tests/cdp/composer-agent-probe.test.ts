import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { probeComposerAgent } from '../../src/cdp/composer-agent-probe';
import {
  parseComposerAgentProbeValue,
  COMPOSER_AGENT_PROBE_JS,
} from '../../src/cdp/probes/composer-agent.v1';

describe('composer-agent probe', () => {
  it('parseComposerAgentProbeValue', () => {
    expect(parseComposerAgentProbeValue({ busy: true, reason: 'stop-icon' })).toEqual({
      busy: true,
      reason: 'stop-icon',
    });
    expect(parseComposerAgentProbeValue(null)).toBeNull();
  });

  it('probe JS is non-empty', () => {
    expect(COMPOSER_AGENT_PROBE_JS).toContain('composer-bar');
  });

  it('FixtureCdp idle', async () => {
    const d = await probeComposerAgent(new FixtureCdp('idle'));
    expect(d.cdpOk).toBe(true);
    expect(d.busy).toBe(false);
    expect(d.reason).toBe('idle');
  });

  it('FixtureCdp busy on cr window', async () => {
    const d = await probeComposerAgent(new FixtureCdp('busy'));
    expect(d.cdpOk).toBe(true);
    expect(d.busy).toBe(true);
    expect(d.reason).toBe('stop-icon');
    expect(d.windowTitle).toContain('cr - cr');
  });

  it('FixtureCdp down', async () => {
    const d = await probeComposerAgent(new FixtureCdp('down'));
    expect(d.cdpOk).toBe(false);
    expect(d.busy).toBe(false);
  });
});
