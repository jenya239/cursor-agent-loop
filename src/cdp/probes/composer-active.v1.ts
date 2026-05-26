export const COMPOSER_ACTIVE_PROBE_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { ok: false, reason: 'no-bar', inComposer: false, hasFocus: false };
  const fromBar = bar.getAttribute('data-composer-id') || bar.getAttribute('data-id');
  const ae = document.activeElement;
  const inComposer = !!(ae && bar.contains(ae));
  const hasFocus = document.hasFocus?.() ?? false;
  if (fromBar) {
    return { ok: true, composerId: fromBar, inComposer, hasFocus, reason: 'composer-bar-id' };
  }
  const tab = document.querySelector(
    '[aria-selected="true"][data-composer-id], [aria-selected="true"][data-id], .tab.active[data-composer-id]'
  );
  const fromTab = tab
    ? tab.getAttribute('data-composer-id') || tab.getAttribute('data-id')
    : null;
  if (fromTab) return { ok: true, composerId: fromTab, inComposer, hasFocus, reason: 'active-tab' };
  return { ok: false, reason: 'no-active-composer', inComposer, hasFocus };
})()`;

export interface ComposerActiveValue {
  ok: boolean;
  composerId?: string;
  inComposer?: boolean;
  hasFocus?: boolean;
  reason: string;
}

export function parseComposerActiveValue(raw: unknown): ComposerActiveValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.ok !== 'boolean' || typeof o.reason !== 'string') return null;
  const composerId = typeof o.composerId === 'string' ? o.composerId : undefined;
  const inComposer = typeof o.inComposer === 'boolean' ? o.inComposer : undefined;
  const hasFocus = typeof o.hasFocus === 'boolean' ? o.hasFocus : undefined;
  return { ok: o.ok, composerId, inComposer, hasFocus, reason: o.reason };
}
