import type { AgentPanelModel } from '../state/selectors';
import { esc } from './dom';

export function renderAgentPanelHtml(m: AgentPanelModel): string {
  const mismatch = m.mismatch
    ? ' · <span class="mismatch">выбранный чат ≠ активный composer</span>'
    : '';
  const fallback =
    m.mismatch && m.composerId
      ? `<div class="switch-fallback">Откройте чат в Cursor вручную · <button type="button" class="copy-composer-id">копировать id</button></div>`
      : '';
  const details = m.cdpDetails
    ? `<div class="agent-cdp-details" title="${esc(m.cdpDetails)}">${esc(m.cdpDetails)}</div>`
    : '';
  const main = `агент · ${esc(m.label)} · ${esc(m.cdpLine)} · ${esc(m.dbLine)}${esc(m.windowLine)}${esc(m.cdpMeta)}${esc(m.switchLine)}${mismatch}`;
  return main + fallback + details;
}

export function applyAgentPanel(el: HTMLElement, m: AgentPanelModel): void {
  el.dataset.phase = m.phase;
  el.innerHTML = renderAgentPanelHtml(m);
  const btn = el.querySelector('.copy-composer-id');
  if (btn && m.composerId) {
    btn.addEventListener('click', () => {
      void navigator.clipboard.writeText(m.composerId!);
    });
  }
}
