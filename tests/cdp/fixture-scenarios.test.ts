import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { COMPOSER_AGENT_PROBE_ID } from '../../src/cdp/port';
import { probeComposerAgent } from '../../src/cdp/composer-agent-probe';
import { CursorMock } from '../../src/cdp/cursor-mock';

describe('multi-busy global vs scoped probe', () => {
  it('global probe finds first busy window', async () => {
    const cdp = new FixtureCdp('multi-busy');
    const g = await probeComposerAgent(cdp);
    expect(g.busy).toBe(true);
  });

  it('scoped mlc composer idle on cdp when only cr busy in busy scenario', async () => {
    const cdp = new FixtureCdp('busy');
    const { probeComposerAgentForComposer } = await import('../../src/cdp/composer-agent-probe');
    const mlc = await probeComposerAgentForComposer(cdp, 'f8e0a645-1610-4a1e-b19f-63f502235a2e', {
      workspaceHints: ['mlc'],
    });
    expect(mlc.cdpOk).toBe(true);
    expect(mlc.busy).toBe(false);
  });
});

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

  it('draft-stuck clears after clearComposerDraft', async () => {
    const cdp = new FixtureCdp('draft-stuck');
    await expect(cdp.sendMessage('x')).rejects.toThrow(/not empty/);
    cdp.clearComposerDraft();
    const r = await cdp.sendMessage('hello');
    expect(r.text).toBe('hello');
  });

  it('multi-busy marks all composered windows busy', async () => {
    const cdp = new FixtureCdp('multi-busy');
    const p = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
    const bars = p.filter((x) => x.reason !== 'no-bar');
    expect(bars.length).toBeGreaterThan(1);
    expect(bars.every((x) => x.busy)).toBe(true);
  });

  it('switch-ok verifies switch', async () => {
    const cdp = new FixtureCdp('switch-ok');
    const r = await cdp.switchComposer('11111111-1111-1111-1111-111111111111', {
      workspaceHints: ['cr'],
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('verified');
  });

  it('CursorMock.port multi-busy', async () => {
    const cdp = CursorMock.port('multi-busy');
    const p = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
    expect(p.filter((x) => x.busy).length).toBeGreaterThan(1);
  });
});
