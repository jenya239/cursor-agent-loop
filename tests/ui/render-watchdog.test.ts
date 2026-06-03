import { renderWatchdogHtml } from '../../src/ui/views/render-watchdog';

describe('renderWatchdogHtml', () => {
  it('renders error hint', () => {
    expect(renderWatchdogHtml(null, 'down')).toContain('npm run dev');
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
          reconnecting: true,
          draftLen: 10,
          draftHasToken: true,
        },
      ],
    });
    expect(html).toContain('slow 1');
    expect(html).toContain('mlc - Cursor');
    expect(html).toContain('busy');
    expect(html).toContain('wd-reconnect');
  });

  it('renders agent state', () => {
    const html = renderWatchdogHtml(
      {
        uptime_ms: 0,
        polls_total: 0,
        slow_recoveries_total: 0,
        errors_total: 0,
        paused: false,
        last_observe_at: null,
        windows: [],
      },
      undefined,
      {
        agents: [
          {
            targetId: 'mlc',
            phase: 'stuck_reconnecting',
            turnVerify: 'pending',
            promptKey: 'Driver:3',
            issue: 'Reconnecting',
            busy: true,
            reconnecting: true,
            since: Date.now(),
          },
        ],
        log: [
          {
            at: '2026-01-01T12:00:00.000Z',
            targetId: 'mlc',
            from: 'running',
            to: 'stuck_reconnecting',
            note: 'Reconnecting',
          },
        ],
      }
    );
    expect(html).toContain('stuck_reconnecting');
    expect(html).toContain('Driver:3');
    expect(html).toContain('transitions');
  });

  it('escapes window title', () => {
    const html = renderWatchdogHtml({
      uptime_ms: 0,
      polls_total: 0,
      slow_recoveries_total: 0,
      errors_total: 0,
      paused: false,
      last_observe_at: null,
      windows: [
        {
          windowTitle: '<script>',
          composerId: 'x',
          model: '',
          busy: false,
          slowCount: 0,
          draftLen: 0,
          draftHasToken: false,
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
