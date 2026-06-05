import { tabVisibility } from '../../src/ui/ui-tabs';
import { loadLayoutPanelHtml, loadLayoutSnapshot } from '../../src/ui/layout-tab';

describe('tabVisibility layout', () => {
  it('layout tab hides chats and shows layout panel', () => {
    expect(tabVisibility('layout')).toEqual({
      layoutHidden: true,
      watchdogHidden: true,
      layoutPanelHidden: false,
      progressHidden: true,
      billingHidden: true,
    });
  });
});

describe('loadLayoutSnapshot', () => {
  it('returns snap on 200', async () => {
    const body = { at: 1, cdpOk: true, windows: [] };
    const { snap, err } = await loadLayoutSnapshot(async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(err).toBeUndefined();
    expect(snap).toEqual(body);
  });

  it('returns err on failure', async () => {
    const { snap, err } = await loadLayoutSnapshot(async () =>
      new Response(JSON.stringify({ error: 'timeout' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(snap).toBeNull();
    expect(err).toBe('timeout');
  });
});

describe('loadLayoutPanelHtml', () => {
  it('200 renders windows count', async () => {
    const html = await loadLayoutPanelHtml(async () =>
      new Response(
        JSON.stringify({
          at: 1,
          cdpOk: true,
          windows: [
            {
              targetId: 'x',
              title: 'Cursor Agents',
              url: '',
              shell: 'agents-v3',
              kind: 'agents-dedicated',
              tree: { id: 'x', label: 'Cursor Agents', kind: 'window' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    expect(html).toContain('Cursor Agents');
    expect(html).toContain('agents-v3');
    expect(html).toContain('data-layout-root');
  });
});
