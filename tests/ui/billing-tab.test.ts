import { tabVisibility } from '../../src/ui/ui-tabs';
import { loadBillingPanelHtml } from '../../src/ui/billing-tab';

describe('tabVisibility billing', () => {
  it('billing tab shows billing panel', () => {
    expect(tabVisibility('billing')).toEqual({
      layoutHidden: true,
      watchdogHidden: true,
      layoutPanelHidden: true,
      progressHidden: true,
      billingHidden: false,
    });
  });
});

describe('loadBillingPanelHtml', () => {
  it('renders empty hint', async () => {
    const html = await loadBillingPanelHtml(async () =>
      new Response(JSON.stringify({ entries: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(html).toContain('cost_entries');
  });

  it('renders billing table', async () => {
    const html = await loadBillingPanelHtml(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              id: 1,
              agent_token: 'cr-agent-x',
              composer_id: 'abcd',
              context_percent: 55,
              model: 'Fast',
              event_type: 'enqueue',
              created_at: '2026-06-05 12:00:00',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    expect(html).toContain('billing-table');
    expect(html).toContain('55%');
    expect(html).toContain('Fast');
  });
});
