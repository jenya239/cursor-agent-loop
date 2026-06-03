import { deriveAgentItemState, withAgentItemState } from '../../../src/cursor/layout/agent-item-state';

describe('deriveAgentItemState', () => {
  it('busy wins over active', () => {
    expect(deriveAgentItemState({ active: true, busy: true })).toBe('busy');
  });

  it('active when not busy', () => {
    expect(deriveAgentItemState({ active: true, busy: false })).toBe('active');
  });

  it('idle by default', () => {
    expect(deriveAgentItemState({})).toBe('idle');
  });
});

describe('withAgentItemState', () => {
  it('adds state field', () => {
    expect(withAgentItemState({ label: 'x', busy: true }).state).toBe('busy');
  });
});
