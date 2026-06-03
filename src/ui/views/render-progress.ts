import type { ProgressReport } from '../../progress/report';

function ago(ms: number | null): string {
  if (ms == null) return '?';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function fmtMsg(e: Record<string, unknown>): string {
  const msg = String(e.msg ?? '');
  const parts: string[] = [msg];
  if (e.role) parts.push(String(e.role));
  if (e.step) parts.push(`step=${e.step}`);
  if (e.phase) parts.push(`phase=${e.phase}`);
  if (e.reason) parts.push(`(${e.reason})`);
  if (e.err) parts.push(`err: ${String(e.err).slice(0, 80)}`);
  if (e.codes) parts.push(String(e.codes));
  return parts.join(' ');
}

function msgClass(msg: string): string {
  if (/error|fail|blocked|stuck/.test(msg)) return 'pr-err';
  if (/sent|recovery/.test(msg)) return 'pr-ok';
  if (/skip|cooldown|backoff/.test(msg)) return 'pr-dim';
  return '';
}

export function renderProgressHtml(report: ProgressReport): string {
  const loopBadge = report.loopRunning
    ? '<span class="pr-badge pr-badge-ok">loop running</span>'
    : '<span class="pr-badge pr-badge-err">loop STOPPED</span>';

  const tickInfo = report.lastTickAt
    ? `last tick <b>${ago(report.lastTickAgoMs)}</b>`
    : 'no ticks recorded';

  const st = report.agentState;
  let stateHtml = '<p class="pr-dim">no agent state</p>';
  if (st) {
    const phaseCls = /running/.test(st.phase) ? 'pr-ok' : /stuck|incomplete/.test(st.phase) ? 'pr-err' : '';
    stateHtml = `
      <div class="pr-state">
        <span class="${phaseCls}"><b>${st.phase}</b></span>
        ${st.promptKey ? `� <b>${st.promptKey}</b>` : ''}
        ${st.turnVerify ? `� verify:${st.turnVerify}` : ''}
        ${st.issue ? `<span class="pr-err"> ? ${st.issue}</span>` : ''}
      </div>`;
  }

  const activeTracks = report.tracks.filter((t) => t.inProgress);
  const closedCount = report.tracks.filter((t) => t.closed).length;
  let trackHtml = '';
  for (const t of activeTracks) {
    const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
    const bar = `<div class="pr-bar"><div class="pr-bar-fill" style="width:${pct}%"></div></div>`;
    trackHtml += `<div class="pr-track"><b>${t.file.replace('TRACK_', '').replace('.md', '')}</b> ${bar} ${t.done}/${t.total} steps � pending: [${t.pendingSteps.join(',')}]</div>`;
  }
  if (!trackHtml) trackHtml = '<p class="pr-dim">no active tracks</p>';
  trackHtml += `<p class="pr-dim">${closedCount} tracks closed total</p>`;

  const actHtml = report.recentActivity.length
    ? report.recentActivity.map((e) => {
        const t = String(e.at ?? '').replace('T', ' ').replace(/\.\d+Z$/, '');
        const cls = msgClass(String(e.msg ?? ''));
        return `<div class="pr-log-row ${cls}"><span class="pr-log-time">${t}</span> ${fmtMsg(e as Record<string, unknown>)}</div>`;
      }).join('')
    : '<p class="pr-dim">no recent activity</p>';

  const errHtml = report.errors.length
    ? report.errors.map((e) => {
        const t = String(e.at ?? '').replace('T', ' ').replace(/\.\d+Z$/, '');
        return `<div class="pr-log-row pr-err"><span class="pr-log-time">${t}</span> ${fmtMsg(e as Record<string, unknown>)}</div>`;
      }).join('')
    : '<p class="pr-dim pr-ok-text">no errors in last 2h</p>';

  return `
<div class="pr-wrap">
  <div class="pr-header">
    ${loopBadge}
    <span class="pr-dim">${tickInfo}</span>
  </div>

  <h3 class="pr-section">Agent state</h3>
  ${stateHtml}

  <h3 class="pr-section">Active track</h3>
  ${trackHtml}

  <h3 class="pr-section">Recent activity</h3>
  <div class="pr-log">${actHtml}</div>

  <h3 class="pr-section">Errors (2h)</h3>
  <div class="pr-log">${errHtml}</div>
</div>`;
}
