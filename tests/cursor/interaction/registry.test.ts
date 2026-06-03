import { resolveAction, resolveFallback } from '../../../src/cursor/interaction/registry';

describe('interaction registry', () => {
  it('resolves stop action', () => {
    expect(typeof resolveAction('stop')).toBe('function');
  });

  it('send requires text', () => {
    expect(() => resolveAction('send')).toThrow(/text/);
  });

  it('fallback dismissModals', () => {
    expect(typeof resolveFallback('dismissModals')).toBe('function');
  });
});
