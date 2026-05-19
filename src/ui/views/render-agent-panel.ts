import type { AgentPanelModel } from '../state/selectors';
import { esc } from './dom';

export function renderAgentPanelHtml(m: AgentPanelModel): string {
  const mismatch = m.mismatch
    ? ' · <span class="mismatch">выбранный чат ≠ активный composer</span>'
    : '';
  return `агент · ${esc(m.label)} · ${esc(m.cdpLine)} · ${esc(m.dbLine)}${esc(m.windowLine)}${esc(m.cdpMeta)}${mismatch}`;
}

export function applyAgentPanel(el: HTMLElement, m: AgentPanelModel): void {
  el.dataset.phase = m.phase;
  el.innerHTML = renderAgentPanelHtml(m);
}
