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
  });

  it('buildComposerSwitchJs embeds id', () => {
    expect(buildComposerSwitchJs('abc')).toContain('abc');
    expect(buildComposerSwitchJs('abc', 'My Chat')).toContain('My Chat');
  });
});
