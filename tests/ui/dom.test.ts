import { esc, shortPath } from '../../src/ui/views/dom';

describe('dom', () => {
  it('esc escapes html', () => {
    expect(esc('<b>&')).toBe('&lt;b&gt;&amp;');
  });

  it('shortPath', () => {
    expect(shortPath('/home/user/proj/foo/bar')).toBe('foo/bar');
  });
});
