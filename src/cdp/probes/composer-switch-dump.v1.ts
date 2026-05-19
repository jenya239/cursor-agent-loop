/** DOM discovery probe for fixture:record / probe:dump (no PII — structure only). */
export const COMPOSER_SWITCH_DUMP_JS = `(() => {
  const out = { composerIds: [], history: [], selectors: [] };
  const add = (arr, item) => {
    if (arr.length < 40) arr.push(item);
  };
  document.querySelectorAll('[data-composer-id], [data-id]').forEach((el) => {
    const id = el.getAttribute('data-composer-id') || el.getAttribute('data-id') || '';
    if (!id || id.length < 8) return;
    add(out.composerIds, {
      id: id.slice(0, 36),
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 80),
    });
  });
  document
    .querySelectorAll(
      '.composer-history-item, [class*="history"] [role="option"], [class*="composer"] [role="listitem"]'
    )
    .forEach((el) => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
      if (!label) return;
      add(out.history, { label, tag: el.tagName });
    });
  if (document.querySelector('.composer-bar')) out.selectors.push('composer-bar');
  if (document.querySelector('.composer-pane')) out.selectors.push('composer-pane');
  return out;
})()`;
