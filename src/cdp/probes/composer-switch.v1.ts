export const COMPOSER_SWITCH_PROBE_ID = 'composer-switch.v1' as const;

export interface ComposerSwitchValue {
  ok: boolean;
  reason: string;
}

export function buildComposerSwitchJs(composerId: string, chatName?: string): string {
  const id = JSON.stringify(composerId);
  const name = JSON.stringify(chatName || '');
  return `(() => {
    const id = ${id};
    const chatName = ${name};
    if (!id) return { ok: false, reason: 'no-id' };
    const click = (el) => {
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    };
    const byId =
      '[data-composer-id="' + id + '"], [data-id="' + id + '"], [data-composer-id="' + id.toLowerCase() + '"]';
    if (click(document.querySelector(byId))) return { ok: true, reason: 'clicked' };
    if (chatName) {
      const hist = document.querySelectorAll(
        '.composer-history-item, [class*="composer"] [role="option"], [class*="history"] a, [class*="chat"]'
      );
      for (const el of hist) {
        const t = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (t && t.includes(chatName) && click(el)) return { ok: true, reason: 'history-name' };
      }
    }
    const rows = document.querySelectorAll('[data-composer-id], [data-id]');
    for (const el of rows) {
      const v = el.getAttribute('data-composer-id') || el.getAttribute('data-id') || '';
      if (v && v.includes(id.slice(0, 8)) && click(el)) return { ok: true, reason: 'partial-id' };
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
