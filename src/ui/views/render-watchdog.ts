import { esc } from './dom';

export interface WatchdogWindowRow {
  windowTitle: string;
  composerId: string;
  model: string;
  busy: boolean;
  slowCount: number;
  draftLen: number;
  draftHasToken: boolean;
}

export interface WatchdogStatsView {
  uptime_ms: number;
  polls_total: number;
  slow_recoveries_total: number;
  errors_total: number;
  paused: boolean;
  last_observe_at: string | null;
  windows: WatchdogWindowRow[];
}

export function renderWatchdogHtml(stats: WatchdogStatsView | null, err?: string): string {
  if (err) return `<p class="err">${esc(err)}</p><p class="hint">npm run watchdog:start</p>`;
  if (!stats) return '<p class="loading">…</p>';
  const rows = stats.windows
    .map(
      (w) =>
        `<tr><td>${esc(w.windowTitle)}</td><td>${esc(w.composerId.slice(0, 8))}</td><td>${esc(w.model || '—')}</td><td>${w.busy ? 'busy' : 'idle'}</td><td>${w.slowCount || ''}</td><td>${w.draftHasToken ? w.draftLen : ''}</td></tr>`
    )
    .join('');
  return `<div class="wd-summary">
  uptime ${Math.round(stats.uptime_ms / 1000)}s · polls ${stats.polls_total} · slow? ${stats.slow_recoveries_total} · err ${stats.errors_total}${stats.paused ? ' · paused' : ''}
  ${stats.last_observe_at ? ` · ${esc(stats.last_observe_at)}` : ''}
</div>
<table class="wd-table"><thead><tr><th>window</th><th>composer</th><th>model</th><th>agent</th><th>slow</th><th>draft</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="hint">??? ????</td></tr>'}</tbody></table>`;
}
