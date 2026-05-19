export const COMPOSER_SWITCH_PROBE_ID = 'composer-switch.v1' as const;

export interface ComposerSwitchValue {
  ok: boolean;
  reason: string;
}

export function buildComposerSwitchJs(composerId: string): string {
  const id = JSON.stringify(composerId);
  return `(() => {
    const id = ${id};
    if (!id) return { ok: false, reason: 'no-id' };
    const sel = '[data-composer-id="' + id + '"], [data-id="' + id + '"], [data-composer-id="' + id.toLowerCase() + '"]';
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { ok: true, reason: 'clicked' };
    }
    return { ok: false, reason: 'no-element' };
  })()`;
}

export function parseComposerSwitchValue(raw: unknown): ComposerSwitchValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.ok !== 'boolean' || typeof o.reason !== 'string') return null;
  return { ok: o.ok, reason: o.reason };
}
