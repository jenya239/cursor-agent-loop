/** Raw value returned from composer-agent probe (live CDP or fixture). */
export interface ComposerAgentProbeValue {
  busy: boolean;
  reason: string;
}

export interface ComposerAgentPageProbe extends ComposerAgentProbeValue {
  title: string;
}

export const COMPOSER_AGENT_PROBE_ID = 'composer-agent.v1' as const;

export const COMPOSER_AGENT_PROBE_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { busy: false, reason: 'no-bar' };
  if (bar.querySelector('.codicon-debug-stop')) return { busy: true, reason: 'stop-icon' };
  const root = bar.closest('.composer-bar-container') || bar;
  const stopBtn = root.querySelector(
    '.codicon-debug-stop, [aria-label*="Stop" i], [aria-label*="останов" i], button.composer-stop-button'
  );
  if (stopBtn) return { busy: true, reason: 'stop-control' };
  const send = root.querySelector(
    'button.composer-send-button, [data-testid="composer-send-button"]'
  );
  const sendLabel = send?.getAttribute('aria-label') || '';
  if (/stop|cancel|abort|останов/i.test(sendLabel)) return { busy: true, reason: 'send-label' };
  if (root.querySelector('[aria-busy="true"], .composer-loading, .composer-generating')) {
    return { busy: true, reason: 'spinner' };
  }
  return { busy: false, reason: 'idle' };
})()`;

export function parseComposerAgentProbeValue(raw: unknown): ComposerAgentProbeValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.busy !== 'boolean' || typeof o.reason !== 'string') return null;
  return { busy: o.busy, reason: o.reason };
}
