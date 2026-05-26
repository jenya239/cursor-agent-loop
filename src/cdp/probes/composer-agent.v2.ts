/** Composer agent probe — searches bar-container (stop/send live outside .composer-bar). */
export const COMPOSER_AGENT_PROBE_V2_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  const root =
    document.querySelector('.composer-bar-container') ||
    bar?.closest('.composer-bar-container') ||
    bar ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar') ||
    document.querySelector('.ui-prompt-input');
  if (!root) return { busy: false, reason: 'no-bar', controls: [] };
  const agentsSend = root.querySelector(
    'button.ui-prompt-input-submit-button, [class*="ui-prompt-input-submit-button"]'
  );
  const agentsAria = agentsSend?.getAttribute('aria-label') || '';
  const stop =
    root.querySelector('.codicon-debug-stop') ||
    (/stop|cancel|abort|останов/i.test(agentsAria) ? agentsSend : null);
  const send =
    root.querySelector('button.composer-send-button, [data-testid="composer-send-button"]') ||
    (!/stop|cancel|abort|останов/i.test(agentsAria) ? agentsSend : null);
  const controls = [];
  const add = (role, el) => {
    if (!el) return;
    const visible = !!(el.offsetParent || el.getClientRects?.().length);
    controls.push({ role, label: el.getAttribute?.('aria-label') || '', visible });
  };
  add('stop', stop?.closest('button,[role=button],.anysphere-icon-button') || stop);
  add('send', send);
  let busy = false;
  let reason = 'idle';
  if (stop) {
    busy = true;
    reason = 'stop-icon';
  } else if (root.querySelector('[aria-busy="true"], .composer-loading, .composer-generating')) {
    busy = true;
    reason = 'spinner';
  } else {
    const sendLabel = send?.getAttribute('aria-label') || '';
    if (/stop|cancel|abort|останов/i.test(sendLabel)) {
      busy = true;
      reason = 'send-label';
    }
  }
  return { busy, reason, controls };
})()`;

export { parseComposerAgentProbeValue } from './composer-agent.v1';
