export interface UiControl {
  role: 'send' | 'stop' | 'unknown';
  label: string;
  visible: boolean;
}

/** Raw value returned from composer-agent probe (live CDP or fixture). */
export interface ComposerAgentProbeValue {
  busy: boolean;
  reason: string;
  controls?: UiControl[];
}

export interface ComposerAgentPageProbe extends ComposerAgentProbeValue {
  title: string;
}

export const COMPOSER_AGENT_PROBE_ID = 'composer-agent.v1' as const;

export const COMPOSER_AGENT_PROBE_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { busy: false, reason: 'no-bar', controls: [] };
  const root = bar.closest('.composer-bar-container') || bar;
  const send = root.querySelector(
    'button.composer-send-button, [data-testid="composer-send-button"]'
  );
  const stopBtn =
    root.querySelector(
      '.codicon-debug-stop, [aria-label*="Stop" i], [aria-label*="останов" i], button.composer-stop-button'
    ) || bar.querySelector('.codicon-debug-stop');
  const controls = [];
  const add = (role, el) => {
    if (!el) return;
    const visible = !!(el.offsetParent || el.getClientRects?.().length);
    controls.push({ role, label: el.getAttribute?.('aria-label') || '', visible });
  };
  add('stop', stopBtn);
  add('send', send);
  const sendLabel = send?.getAttribute('aria-label') || '';
  let busy = false;
  let reason = 'idle';
  if (bar.querySelector('.codicon-debug-stop')) {
    busy = true;
    reason = 'stop-icon';
  } else if (stopBtn) {
    busy = true;
    reason = 'stop-control';
  } else if (/stop|cancel|abort|останов/i.test(sendLabel)) {
    busy = true;
    reason = 'send-label';
  } else if (root.querySelector('[aria-busy="true"], .composer-loading, .composer-generating')) {
    busy = true;
    reason = 'spinner';
  }
  return { busy, reason, controls };
})()`;

function parseControls(raw: unknown): UiControl[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: UiControl[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.role !== 'string' || typeof o.label !== 'string' || typeof o.visible !== 'boolean') {
      continue;
    }
    const role =
      o.role === 'send' || o.role === 'stop' || o.role === 'unknown' ? o.role : 'unknown';
    out.push({ role, label: o.label, visible: o.visible });
  }
  return out.length ? out : undefined;
}

export function parseComposerAgentProbeValue(raw: unknown): ComposerAgentProbeValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.busy !== 'boolean' || typeof o.reason !== 'string') return null;
  const controls = parseControls(o.controls);
  return controls ? { busy: o.busy, reason: o.reason, controls } : { busy: o.busy, reason: o.reason };
}
