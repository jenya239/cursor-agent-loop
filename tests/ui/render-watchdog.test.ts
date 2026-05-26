import { renderWatchdogHtml } from '../../src/ui/views/render-watchdog';

describe('renderWatchdogHtml', () => {
  it('renders error hint', () => {
    expect(renderWatchdogHtml(null, 'down')).toContain('watchdog:start');
  });

  it('renders windows table', () => {
    const html = renderWatchdogHtml({
      uptime_ms: 5000,
      polls_total: 2,
      slow_recoveries_total: 1,
      errors_total: 0,
      paused: false,
      last_observe_at: '2026-01-01T00:00:00Z',
      windows: [
        {
          windowTitle: 'mlc - Cursor',
          composerId: 'abcd1234-0000',
          model: 'Fast',
          busy: true,
          slowCount: 2,
          draftLen: 10,
          draftHasToken: true,
        },
      ],
    });
    expect(html).toContain('slow? 1');
    expect(html).toContain('mlc - Cursor');
    expect(html).toContain('busy');
  });
});
