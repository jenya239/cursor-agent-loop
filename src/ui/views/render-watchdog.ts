import { esc } from './dom';

export interface WatchdogWindowRow {
  windowTitle: string;
  composerId: string;
  model: string;
  busy: boolean;
  slowCount: number;
  reconnecting?: boolean;
  draftLen: number;
  draftHasToken: boolean;
  usagePct?: number | null;
}

export interface WatchdogStatsView {
  uptime_ms: number;
  polls_total: number;
  slow_recoveries_total: number;
  errors_total: number;
  paused: boolean;
  usageMax?: number | null;
  last_observe_at: string | null;
  windows: WatchdogWindowRow[];
}

export interface AgentStateRow {
  targetId: string;
  phase: string;
  turnVerify: string;
  promptKey?: string;
  issue?: string;
  busy?: boolean;
  reconnecting?: boolean;
  since: number;
}

export interface AgentTransitionRow {
  at: string;
  targetId: string;
  from?: string;
  to: string;
  promptKey?: string;
  note?: string;
}

export interface AgentStateView {
  agents: AgentStateRow[];
  log: AgentTransitionRow[];
}

function phaseClass(phase: string): string {
  if (/stuck|incomplete|blocked/.test(phase)) return 'wd-bad';
  if (/done|idle/.test(phase)) return 'wd-ok';
  if (/pending|running/.test(phase)) return 'wd-warn';
  return '';
}

function renderAgentSection(agent: AgentStateView | null | undefined, agentErr?: string): string {
  if (agentErr) {
    return `<p class="hint wd-agent-err">${esc(agentErr)}</p>`;
  }
  if (!agent?.agents?.length) return '';

  const rows = agent.agents
    .map((a) => {
      const cls = phaseClass(a.phase);
      const issue = a.issue ? esc(a.issue) : '';
      const flags = [a.reconnecting ? 'reconnect' : '', a.busy ? 'busy' : ''].filter(Boolean).join(' ');
      return `<tr class="${cls}"><td>${esc(a.targetId)}</td><td>${esc(a.phase)}</td><td>${esc(a.turnVerify)}</td><td>${esc(a.promptKey || '')}</td><td>${flags}</td><td>${issue}</td></tr>`;
    })
    .join('');

  const log = (agent.log || [])
    .slice(-12)
    .reverse()
    .map((t) => {
      const from = t.from ? `${esc(t.from)}→` : '';
      const note = t.note ? ` · ${esc(t.note)}` : '';
      const key = t.promptKey ? ` · ${esc(t.promptKey)}` : '';
      return `<li><span class="wd-log-at">${esc(t.at.slice(11, 19))}</span> ${esc(t.targetId)} ${from}${esc(t.to)}${key}${note}</li>`;
    })
    .join('');

  return `<h3 class="wd-h">orch</h3>
<table class="wd-table wd-agent"><thead><tr><th>target</th><th>phase</th><th>verify</th><th>prompt</th><th>flags</th><th>issue</th></tr></thead><tbody>${rows}</tbody></table>
<h3 class="wd-h">transitions</h3>
<ul class="wd-log">${log || '<li class="hint">—</li>'}</ul>`;
}

export function renderWatchdogHtml(
  stats: WatchdogStatsView | null,
  err?: string,
  agent?: AgentStateView | null,
  agentErr?: string
): string {
  const agentBlock = renderAgentSection(agent, agentErr);
  if (err) {
    return `${agentBlock}<p class="err">${esc(err)}</p><p class="hint">npm run dev (watchdog in-process)</p>`;
  }
  if (!stats) return `${agentBlock}<p class="loading">...</p>`;

  const rows = stats.windows
    .map((w) => {
      const cls = w.reconnecting ? 'wd-reconnect' : w.busy && w.slowCount ? 'wd-slow' : '';
      const recon = w.reconnecting ? 'yes' : '';
      return `<tr class="${cls}"><td>${esc(w.windowTitle)}</td><td>${esc(w.composerId.slice(0, 8))}</td><td>${esc(w.model || '-')}</td><td>${w.busy ? 'busy' : 'idle'}</td><td>${recon}</td><td>${w.usagePct != null ? w.usagePct + '%' : ''}</td><td>${w.slowCount || ''}</td><td>${w.draftHasToken ? w.draftLen : ''}</td></tr>`;
    })
    .join('');

  const usageLine = stats.usageMax != null ? ` usageMax ${stats.usageMax}%` : '';
  return `${agentBlock}<div class="wd-summary">
  uptime ${Math.round(stats.uptime_ms / 1000)}s | polls ${stats.polls_total} | slow ${stats.slow_recoveries_total} | err ${stats.errors_total}${stats.paused ? ' | paused' : ''}${usageLine}
  ${stats.last_observe_at ? ` | ${esc(stats.last_observe_at)}` : ''}
</div>
<table class="wd-table"><thead><tr><th>window</th><th>composer</th><th>model</th><th>agent</th><th>recon</th><th>usage</th><th>slow</th><th>draft</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="hint">no windows</td></tr>'}</tbody></table>`;
}
