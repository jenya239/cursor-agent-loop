import { parseComposerActiveValue } from '../src/cdp/probes/composer-active.v1';

describe('composer-active.v1', () => {
  it('parse composer-bar-id', () => {
    expect(
      parseComposerActiveValue({
        ok: true,
        composerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
        inComposer: true,
        hasFocus: true,
        reason: 'composer-bar-id',
      })
    ).toMatchObject({
      ok: true,
      composerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
      hasFocus: true,
      reason: 'composer-bar-id',
    });
  });

  it('parse not found', () => {
    expect(parseComposerActiveValue({ ok: false, reason: 'no-active-composer' })).toEqual({
      ok: false,
      reason: 'no-active-composer',
    });
  });
});
