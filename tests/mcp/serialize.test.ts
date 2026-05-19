import { mcpJson, trimMessages, truncateText } from '../../src/mcp/serialize';

describe('mcp serialize', () => {
  it('truncateText', () => {
    expect(truncateText('ab', 10)).toBe('ab');
    expect(truncateText('x'.repeat(20), 5)).toContain('truncated');
  });

  it('trimMessages keeps tail', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      bubbleId: `b${i}`,
      role: 'user' as const,
      text: String(i),
    }));
    const r = trimMessages(msgs, 3);
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0].text).toBe('7');
    expect(r.truncated).toBe(true);
  });

  it('mcpJson caps huge payload', () => {
    const s = mcpJson({ x: 'y'.repeat(600_000) }, 1000);
    const o = JSON.parse(s);
    expect(o.error).toBe('response too large');
  });
});
