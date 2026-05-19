import { bubbleText } from '../src/db/bubble-text';

describe('bubbleText', () => {
  it('uses text', () => {
    expect(bubbleText({ text: 'hello' })).toBe('hello');
  });

  it('parses richText', () => {
    const rich = {
      root: { children: [{ children: [{ text: 'привет' }] }] },
    };
    expect(bubbleText({ richText: rich })).toBe('привет');
  });

  it('formats toolFormerData', () => {
    expect(
      bubbleText({
        toolFormerData: {
          name: 'read_file',
          rawArgs: '{"path":"/tmp/a.ts"}',
        },
      })
    ).toBe('[read_file] /tmp/a.ts');
  });

  it('extracts thinking object', () => {
    expect(bubbleText({ thinking: { text: 'planning…' } })).toBe('planning…');
  });

  it('combines text and tool', () => {
    const s = bubbleText({
      text: 'Doing work',
      toolFormerData: { name: 'grep', rawArgs: '{"pattern":"x"}' },
    });
    expect(s).toContain('Doing work');
    expect(s).toContain('[grep]');
  });
});
