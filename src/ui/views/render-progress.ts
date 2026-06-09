import type { ProgressReport, SessionTurn, GitCommit, MeetingSummary } from '../../progress/report';

function ago(ms: number | null): string {
  if (ms == null) return '?';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  return esc(parts.join(' '));
}

function msgClass(msg: string): string {
  if (/error|fail|blocked|stuck/.test(msg)) return 'pr-err';
  if (/sent|recovery/.test(msg)) return 'pr-ok';
  if (/skip|cooldown|backoff/.test(msg)) return 'pr-dim';
  return '';
}

function roleCls(role: string): string {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r === 'driver') return 'pr-role-driver';
  if (r === 'critic') return 'pr-role-critic';
  if (r === 'planner') return 'pr-role-planner';
  if (r === 'meta') return 'pr-role-meta';
  if (r === 'cleaner' || r === 'backlog') return 'pr-role-util';
  return 'pr-role-util';
}

function renderSessionTable(turns: SessionTurn[]): string {
  if (!turns.length) return '<p class="pr-dim">no SESSION.md data</p>';
  const rows = turns.map((t) => {
    const rc = roleCls(t.role);
    const gate = t.gate.replace(/build_tests\s*/i, '').replace(/;\s*build\.sh OK/i, '').trim();
    // show full datetime: "2026-06-03 15:09" if has time, else just date
    const timeStr = t.date.length > 10 ? t.date.slice(0, 16) : t.date;
    return `<tr>
      <td class="pr-td-time">${esc(timeStr)}</td>
      <td><span class="pr-role ${rc}">${esc(t.role || '?')}</span></td>
      <td class="pr-td-step">${esc(t.step)}</td>
      <td class="pr-td-done">${esc(t.done)}</td>
      <td class="pr-td-gate">${esc(gate)}</td>
    </tr>`;
  }).join('');
  return `<table class="pr-table">
    <thead><tr><th>Time</th><th>Role</th><th>Step</th><th>Done</th><th>Gate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderMeetingsTable(meetings: MeetingSummary[]): string {
  if (!meetings.length) return '<p class="pr-dim">no meeting rooms</p>';
  const rows = meetings.map((meeting) => {
    const status = meeting.endedAt ? esc(meeting.endedAt) : '<span class="pr-ok">open</span>';
    return `<tr>
      <td class="pr-td-time">${esc(meeting.startedAt)}</td>
      <td class="pr-td-done">${esc(meeting.topic)}</td>
      <td><code class="pr-hash">${esc(meeting.slug)}</code></td>
      <td class="pr-td-gate">${status}</td>
    </tr>`;
  }).join('');
  return `<table class="pr-table">
    <thead><tr><th>Date</th><th>Topic</th><th>Slug</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderCommits(commits: GitCommit[]): string {
  if (!commits.length) return '<p class="pr-dim">no commits</p>';
  const rows = commits.map((c) => `<tr>
    <td class="pr-td-time">${esc(c.time.slice(5, 16))}</td>
    <td><code class="pr-hash">${esc(c.hash)}</code></td>
    <td class="pr-td-done">${esc(c.msg)}</td>
  </tr>`).join('');
  return `<table class="pr-table">
    <thead><tr><th>Time</th><th>Hash</th><th>Message</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
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
        <span class="${phaseCls}"><b>${esc(st.phase)}</b></span>
        ${st.promptKey ? `&rarr; <b>${esc(st.promptKey)}</b>` : ''}
        ${st.turnVerify ? `&middot; verify:${esc(st.turnVerify)}` : ''}
        ${st.issue ? `<span class="pr-err"> &#9888; ${esc(st.issue)}</span>` : ''}
      </div>`;
  }

  const primaryTrack = report.tracks.find((t) => t.isPrimary && !t.closed);
  const queuedTracks = report.tracks.filter((t) => t.inProgress && !t.closed && !t.isPrimary);
  const closedCount = report.tracks.filter((t) => t.closed).length;
  let trackHtml = '';
  if (primaryTrack) {
    const pct = primaryTrack.total ? Math.round((primaryTrack.done / primaryTrack.total) * 100) : 0;
    const bar = `<div class="pr-bar"><div class="pr-bar-fill" style="width:${pct}%"></div></div>`;
    trackHtml += `<div class="pr-track pr-track-primary"><b>${esc(primaryTrack.file.replace('TRACK_', '').replace('.md', ''))}</b> ${bar} ${primaryTrack.done}/${primaryTrack.total} steps &middot; pending: [${primaryTrack.pendingSteps.join(',')}]</div>`;
  }
  if (queuedTracks.length) {
    const names = queuedTracks.map((t) => t.file.replace('TRACK_', '').replace('.md', '')).join(', ');
    trackHtml += `<p class="pr-dim">queued: ${esc(names)}</p>`;
  }

  const upcomingTracks = report.tracks
    .filter((t) => !t.closed && !t.inProgress)
    .sort((a, b) => a.file.localeCompare(b.file));
  if (upcomingTracks.length) {
    const rows = upcomingTracks.map((t) => {
      const name = t.file.replace('TRACK_', '').replace('.md', '');
      return `<span class="pr-upcoming-name">${esc(name)}</span>`;
    }).join(' · ');
    trackHtml += `<p class="pr-dim pr-upcoming">next: ${rows}</p>`;
  }

  if (report.plannedItems?.length) {
    const rows = report.plannedItems.map((item) =>
      `<div class="pr-planned-row">${esc(item)}</div>`
    ).join('');
    trackHtml += `<details class="pr-planned"><summary class="pr-dim">plan phases</summary>${rows}</details>`;
  }

  if (!trackHtml) trackHtml = '<p class="pr-dim">no active tracks</p>';

  // last 5 closed tracks, newest first
  const recentClosed = report.tracks
    .filter((t) => t.closed)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
    .slice(0, 5);
  if (recentClosed.length) {
    const rows = recentClosed.map((t) => {
      const name = t.file.replace('TRACK_', '').replace('.md', '');
      const when = t.closedAt ? `<span class="pr-td-time">${esc(t.closedAt)}</span>` : '';
      return `<div class="pr-closed-row">${when} <span class="pr-closed-name">${esc(name)}</span> <span class="pr-dim">${t.done}/${t.total}</span></div>`;
    }).join('');
    trackHtml += `<div class="pr-closed-list">${rows}</div>`;
  }
  trackHtml += `<p class="pr-dim">${closedCount} tracks closed total</p>`;

  const actHtml = report.recentActivity.length
    ? report.recentActivity.map((e) => {
        const t = String(e.at ?? '').replace('T', ' ').replace(/\.\d+Z$/, '');
        const cls = msgClass(String(e.msg ?? ''));
        return `<div class="pr-log-row ${cls}"><span class="pr-log-time">${esc(t)}</span> ${fmtMsg(e as Record<string, unknown>)}</div>`;
      }).join('')
    : '<p class="pr-dim">no recent activity</p>';

  const errHtml = report.errors.length
    ? report.errors.map((e) => {
        const t = String(e.at ?? '').replace('T', ' ').replace(/\.\d+Z$/, '');
        return `<div class="pr-log-row pr-err"><span class="pr-log-time">${esc(t)}</span> ${fmtMsg(e as Record<string, unknown>)}</div>`;
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

  <h3 class="pr-section">Agent turns</h3>
  ${renderSessionTable(report.sessionTurns)}

  <h3 class="pr-section">Meeting rooms</h3>
  ${renderMeetingsTable(report.meetings)}

  <h3 class="pr-section">Commits</h3>
  ${renderCommits(report.recentCommits)}

  <h3 class="pr-section">Recent activity (log)</h3>
  <div class="pr-log">${actHtml}</div>

  <h3 class="pr-section">Errors (2h)</h3>
  <div class="pr-log">${errHtml}</div>
</div>`;
}
