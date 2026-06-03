import { tabVisibility } from '../../src/ui/ui-tabs';
import { loadWatchdogPanelHtml } from '../../src/ui/watchdog-tab';

describe('tabVisibility', () => {
  it('chats tab shows layout', () => {
    expect(tabVisibility('chats')).toEqual({
      layoutHidden: false,
      watchdogHidden: true,
      layoutPanelHidden: true,
    });
  });

  it('watchdog tab shows panel', () => {
    expect(tabVisibility('watchdog')).toEqual({
      layoutHidden: true,
      watchdogHidden: false,
      layoutPanelHidden: true,
    });
  });
});

describe('loadWatchdogPanelHtml', () => {
  it('404 ? restart hint', async () => {
    const html = await loadWatchdogPanelHtml(async () =>
      new Response('not found', { status: 404 })
    );
    expect(html).toContain('npm run dev');
  });

  it('503 json error', async () => {
    const html = await loadWatchdogPanelHtml(async () =>
      new Response(JSON.stringify({ error: 'watchdog disabled' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(html).toContain('watchdog disabled');
  });

  it('200 renders stats table', async () => {
    const html = await loadWatchdogPanelHtml(async (url) => {
      if (url.includes('/api/agent/state')) {
        return new Response(
          JSON.stringify({
            agents: [{ targetId: 'mlc', phase: 'running', turnVerify: 'ok', since: 1 }],
            log: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          uptime_ms: 1000,
          polls_total: 1,
          slow_recoveries_total: 0,
          errors_total: 0,
          paused: false,
          last_observe_at: null,
          windows: [
            {
              windowTitle: 'mlc',
              composerId: 'abcd1234-0000',
              model: 'Fast',
              busy: true,
              slowCount: 1,
              reconnecting: false,
              draftLen: 0,
              draftHasToken: false,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    expect(html).toContain('mlc');
    expect(html).toContain('busy');
    expect(html).toContain('running');
  });
});
