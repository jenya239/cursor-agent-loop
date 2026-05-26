import {
  buildComposerSwitchJs,
  parseComposerSwitchValue,
} from '../../src/cdp/probes/composer-switch.v1';

describe('composer-switch.v1', () => {
  it('parseComposerSwitchValue', () => {
    expect(parseComposerSwitchValue({ ok: false, reason: 'no-element' })).toEqual({
      ok: false,
      reason: 'no-element',
    });
    expect(parseComposerSwitchValue({ ok: true, reason: 'history-name', target: 'win' })).toEqual({
      ok: true,
      reason: 'history-name',
      target: 'win',
    });
  });

  it('switch-ok fixture scenario', async () => {
    const { FixtureCdp } = await import('../../src/cdp/fixture-cdp');
    const cdp = new FixtureCdp('switch-ok');
    const r = await cdp.switchComposer('11111111-1111-1111-1111-111111111111', {
      workspaceHints: ['cr'],
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('verified');
    expect(r.switchTarget).toContain('cr - cr');
  });

  it('buildComposerSwitchJs embeds id', () => {
    expect(buildComposerSwitchJs('abc')).toContain('abc');
    expect(buildComposerSwitchJs('abc', 'My Chat')).toContain('My Chat');
  });
});
