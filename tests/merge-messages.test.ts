import { mergeMessages } from '../src/db/merge-messages';

describe('mergeMessages', () => {
  it('merges consecutive assistant lines', () => {
    const out = mergeMessages([
      { bubbleId: '1', role: 'assistant', text: 'a' },
      { bubbleId: '2', role: 'assistant', text: 'b' },
      { bubbleId: '3', role: 'user', text: 'q' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('a\nb');
  });
});
