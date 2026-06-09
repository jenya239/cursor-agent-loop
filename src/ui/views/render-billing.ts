import type { CostEntryRow } from '../../db/cost-entries';
import { esc } from './dom';

export type BillingView = {
  entries: CostEntryRow[];
};

export function renderBillingHtml(data: BillingView | null, error?: string): string {
  if (error) {
    return `<p class="billing-error">${esc(error)}</p>`;
  }
  if (!data?.entries.length) {
    return '<p class="hint">No cost_entries records — they will appear after cursor_enqueue_send.</p>';
  }
  const rows = data.entries
    .map(
      (entry) => `<tr>
        <td>${esc(entry.created_at)}</td>
        <td>${esc(entry.event_type)}</td>
        <td>${entry.context_percent != null ? `${entry.context_percent}%` : '—'}</td>
        <td>${esc(entry.model ?? '—')}</td>
        <td>${esc(shortToken(entry.agent_token))}</td>
        <td>${esc(shortComposer(entry.composer_id))}</td>
      </tr>`
    )
    .join('');
  return `<table class="billing-table">
    <thead><tr>
      <th>time</th><th>event</th><th>context</th><th>model</th><th>token</th><th>composer</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function shortToken(token: string | null): string {
  if (!token) return '—';
  return token.length > 16 ? `${token.slice(0, 14)}…` : token;
}

function shortComposer(composerId: string | null): string {
  if (!composerId) return '—';
  return composerId.length > 12 ? `${composerId.slice(0, 8)}…` : composerId;
}
