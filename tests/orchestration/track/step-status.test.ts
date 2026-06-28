import { classifyStepStatus, isStepClosed, isStepOpen } from '../../../src/orchestration/track/step-status';

describe('classifyStepStatus', () => {
  it('pending', () => {
    expect(classifyStepStatus('pending')).toBe('pending');
  });

  it('done', () => {
    expect(classifyStepStatus('done')).toBe('done');
    expect(classifyStepStatus('done (if-chain + enclosing return)')).toBe('done');
  });

  it('done partial without pending word is closed', () => {
    expect(classifyStepStatus('done (partial)')).toBe('done');
    expect(classifyStepStatus('done (partial — Ruby emit; mlc SEGV open)')).toBe('done');
  });

  it('done partial with gate pending stays open', () => {
    expect(classifyStepStatus('done (partial — emit ok; bootstrap gate pending)')).toBe('pending');
  });

  it('skip', () => {
    expect(classifyStepStatus('skip')).toBe('skip');
    expect(isStepClosed('skip')).toBe(true);
    expect(isStepOpen('pending')).toBe(true);
  });
});
