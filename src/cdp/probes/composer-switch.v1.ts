export const COMPOSER_SWITCH_PROBE_ID = 'composer-switch.v1' as const;

export interface ComposerSwitchValue {
  ok: boolean;
  reason: string;
  target?: string;
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
      el.scrollIntoView({ block: 'nearest' });
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    };
    const byId =
      '[data-composer-id="' + id + '"], [data-id="' + id + '"], [data-composer-id="' + id.toLowerCase() + '"]';
    if (click(document.querySelector(byId))) return { ok: true, reason: 'clicked' };
    const short = id.slice(0, 8);
    for (const el of document.querySelectorAll('[data-composer-id], [data-id]')) {
      const v = el.getAttribute('data-composer-id') || el.getAttribute('data-id') || '';
      if (v && (v === id || v.startsWith(short))) {
        if (click(el)) return { ok: true, reason: 'partial-id' };
      }
    }
    const tab = document.querySelector('[aria-selected="true"][data-composer-id], .tab.active[data-composer-id]');
    if (tab) {
      const v = tab.getAttribute('data-composer-id') || tab.getAttribute('data-id') || '';
      if (v === id || v.startsWith(short)) return { ok: true, reason: 'active-tab' };
    }
    if (chatName) {
      const hist = document.querySelectorAll(
        '.composer-history-item, [class*="ComposerHistory"] *, [class*="composer"] [role="option"], [class*="history"] a, [class*="history"] [role="listitem"], [class*="chat-history"] *, li[role="treeitem"]'
      );
      for (const el of hist) {
        const t = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (t && t.includes(chatName) && click(el)) return { ok: true, reason: 'history-name' };
      }
    }
    const rows = document.querySelectorAll('[aria-label*="Chat" i]');
    for (const el of rows) {
      if (chatName && (el.getAttribute('aria-label') || '').includes(chatName) && click(el)) {
        return { ok: true, reason: 'aria-chat' };
      }
    }
    return { ok: false, reason: 'no-element' };
  })()`;
}

export function parseComposerSwitchValue(raw: unknown): ComposerSwitchValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.ok !== 'boolean' || typeof o.reason !== 'string') return null;
  const target = typeof o.target === 'string' ? o.target : undefined;
  return target ? { ok: o.ok, reason: o.reason, target } : { ok: o.ok, reason: o.reason };
}
