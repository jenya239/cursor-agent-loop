import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { observeLayoutFixture } from '../../src/cdp/fixture-layout';
import { observeCursorLayout } from '../../src/cursor/layout/observe';

describe('observeLayoutFixture', () => {
  it('returns 4 windows including Cursor Agents', async () => {
    const snap = await observeLayoutFixture(new FixtureCdp('idle'));
    expect(snap.windows).toHaveLength(4);
    expect(snap.windows.map((w) => w.shell)).toContain('agents-v3');
    expect(snap.windows.map((w) => w.shell)).toContain('workbench-v2');
  });

  it('mlc workbench has thread and busy agent in tree', async () => {
    const snap = await observeLayoutFixture(new FixtureCdp('idle'));
    const mlc = snap.windows.find((w) => w.title.includes('mlc'));
    const flat = JSON.stringify(mlc?.tree);
    expect(flat).toContain('supervisor');
    expect(flat).toContain('composer-thread');
    expect(flat).toContain('busy');
  });

  it('busy scenario adds thread active tool on cr', async () => {
    const snap = await observeLayoutFixture(new FixtureCdp('busy'));
    const cr = snap.windows.find((w) => w.title.includes('cr - cr'));
    const flat = JSON.stringify(cr?.tree);
    expect(flat).toContain('Worked for 8s');
    expect(flat).toContain('composer-thread');
  });

  it('agents-v3 window has separate sidebar tree', async () => {
    const snap = await observeLayoutFixture(new FixtureCdp('idle'));
    const agents = snap.windows.find((w) => w.title === 'Cursor Agents');
    const flat = JSON.stringify(agents?.tree);
    expect(flat).toContain('agents-sidebar');
    expect(flat).toContain('cr worker');
  });
});

describe('observeCursorLayout routes fixture', () => {
  it('uses fixture path', async () => {
    const snap = await observeCursorLayout(new FixtureCdp('idle'));
    expect(snap.cdpOk).toBe(true);
    expect(snap.windows.length).toBeGreaterThan(0);
  });
});
