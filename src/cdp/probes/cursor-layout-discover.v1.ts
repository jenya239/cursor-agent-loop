export const CURSOR_LAYOUT_DISCOVER2_JS = `(() => {
  const seen = new Set();
  const hits = [];
  for (const el of document.querySelectorAll('*')) {
    const cls = (el.className || '').toString();
    if (!/(agent|composer|chat|history|anysphere|aislash)/i.test(cls)) continue;
    const key = cls.slice(0, 80) + '|' + el.tagName;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      tag: el.tagName,
      cls: cls.slice(0, 120),
      role: el.getAttribute('role') || '',
      composerId: (el.getAttribute('data-composer-id') || '').slice(0, 36),
      aria: (el.getAttribute('aria-label') || '').slice(0, 60),
      childCount: el.children.length,
    });
    if (hits.length >= 80) break;
  }
  const bars = [...document.querySelectorAll('.composer-bar, .composer-bar-container, [class*="composer-bar"]')].map((el) => ({
    cls: (el.className || '').toString().slice(0, 120),
    composerId: el.getAttribute('data-composer-id') || '',
    parentCls: (el.parentElement?.className || '').toString().slice(0, 80),
  }));
  const tabs = [...document.querySelectorAll('[class*="tab" i][class*="composer" i], [class*="Composer" i][role="tab"], .composer-bar ~ * [role="tab"]')].slice(0, 20).map((el) => ({
    cls: (el.className || '').toString().slice(0, 100),
    text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
    composerId: el.getAttribute('data-composer-id') || '',
  }));
  const leftBar = [...document.querySelectorAll('.part.activitybar .action-label, .activity-bar .action-label, .monaco-workbench .activitybar .action-label')].map((el) => (el.textContent || '').trim()).filter(Boolean);
  const actionLabels = [...document.querySelectorAll('.monaco-action-bar .action-label')].map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 30);
  const ariaAgents = [...document.querySelectorAll('[aria-label*="Agent" i], [aria-label*="agent" i], [aria-label*="Chat" i]')].slice(0, 30).map((el) => ({
    tag: el.tagName,
    cls: (el.className || '').toString().slice(0, 80),
    aria: (el.getAttribute('aria-label') || '').slice(0, 80),
    composerId: (el.getAttribute('data-composer-id') || '').slice(0, 36),
  }));
  return { title: document.title, leftBar, actionLabels, bars, tabs, ariaAgents, classHits: hits.slice(0, 40) };
})()`;
