import {
  inferAgentRole,
  parseComposerBarProbe,
  parseStopAgentResult,
} from '../../src/cdp/composer-bar';

describe('parseComposerBarProbe', () => {
  it('parses live-shaped payload', () => {
    const p = parseComposerBarProbe({
      composerId: 'abc',
      model: 'claude-4.6-opus-medium-thinking',
      agentRole: 'supervisor',
      busy: true,
      slowCount: 1,
      draftLen: 0,
      draftHasToken: false,
      pairs: [{ preview: 'hi', slow: false }],
    });
    expect(p?.agentRole).toBe('supervisor');
    expect(p?.slowCount).toBe(1);
  });

  it('infers supervisor from model when agentRole missing', () => {
    const p = parseComposerBarProbe({
      composerId: 'x',
      model: 'GPT-5 Codex',
      busy: false,
      slowCount: 0,
      draftLen: 0,
      draftHasToken: false,
      pairs: [],
    });
    expect(p?.agentRole).toBe('supervisor');
  });

  it('returns null for garbage', () => {
    expect(parseComposerBarProbe(null)).toBeNull();
    expect(parseComposerBarProbe({ model: 'x' })).toBeNull();
  });
});

describe('inferAgentRole', () => {
  it('explicit wins over heuristic', () => {
    expect(inferAgentRole('gpt-5', 'default')).toBe('default');
    expect(inferAgentRole('Composer 1', 'supervisor')).toBe('supervisor');
  });
});

describe('parseStopAgentResult', () => {
  it('parses ok', () => {
    expect(parseStopAgentResult({ ok: true, reason: 'clicked-stop' })).toEqual({
      ok: true,
      reason: 'clicked-stop',
    });
  });
});
