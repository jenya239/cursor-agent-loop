import {
  renderWatchdogHtml,
  type AgentStateView,
  type WatchdogStatsView,
} from './views/render-watchdog';

async function fetchJson<T>(fetchFn: (url: string) => Promise<Response>, url: string): Promise<T | null> {
  try {
    const r = await fetchFn(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function loadWatchdogPanelHtml(
  fetchFn: (url: string) => Promise<Response> = fetch
): Promise<string> {
  const [wdRes, agent] = await Promise.all([
    fetchFn('/api/watchdog/stats'),
    fetchJson<AgentStateView>(fetchFn, '/api/agent/state?refresh=1'),
  ]);

  const ct = wdRes.headers.get('content-type') || '';
  if (!wdRes.ok) {
    if (wdRes.status === 404) {
      return renderWatchdogHtml(null, 'нет /api/watchdog/stats — перезапусти npm run dev', agent);
    }
    if (ct.includes('json')) {
      const body = (await wdRes.json()) as { error?: string };
      return renderWatchdogHtml(null, body.error || wdRes.statusText, agent);
    }
    return renderWatchdogHtml(null, wdRes.statusText, agent);
  }

  return renderWatchdogHtml((await wdRes.json()) as WatchdogStatsView, undefined, agent);
}
