import type { CursorLayoutSnapshot, LayoutNode } from '../../cursor/layout/types';
import { esc } from './dom';

export function renderNodeHeadHtml(node: LayoutNode): string {
  const kind = `<span class="lk">${esc(node.kind)}</span>`;
  const state = node.state ? ` <span class="ls">${esc(node.state)}</span>` : '';
  const attrs =
    node.attrs && Object.keys(node.attrs).length
      ? ` <span class="la">${esc(
          Object.entries(node.attrs)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        )}</span>`
      : '';
  return `<span class="ll">${esc(node.label)}</span> ${kind}${state}${attrs}`;
}

function renderNode(node: LayoutNode, depth: number): string {
  const pad = depth * 12;
  const head = renderNodeHeadHtml(node);
  const lid = ` data-lid="${esc(node.id)}"`;
  if (!node.children?.length) {
    return `<div class="ln"${lid} style="padding-left:${pad}px">${head}</div>`;
  }
  const inner = node.children.map((c) => renderNode(c, depth + 1)).join('');
  return `<details class="ln"${lid} style="padding-left:${pad}px" open><summary>${head}</summary>${inner}</details>`;
}

export function renderLayoutTreeHtml(snap: CursorLayoutSnapshot | null, err?: string): string {
  if (err) {
    return `<p class="err">${esc(err)}</p><p class="hint">npm run dev, CDP on :9222</p>`;
  }
  if (!snap) return '<p class="loading">loading...</p>';
  if (!snap.cdpOk) return '<p class="err">CDP nedostupen</p>';
  if (!snap.windows.length) return '<p class="hint">net okon</p>';
  const summary = `<div class="wd-summary" data-layout-part="summary">okon ${snap.windows.length} &middot; ${new Date(snap.at).toISOString()}</div>`;
  const trees = snap.windows
    .map((w) => {
      const meta = `<div class="lw-head">${esc(w.title)} &middot; <code>${esc(w.shell)}</code> &middot; ${esc(w.kind)}</div>`;
      return `<section class="lw" data-window-id="${esc(w.targetId)}">${meta}<div class="layout-tree">${renderNode(w.tree, 0)}</div></section>`;
    })
    .join('');
  return `<div data-layout-root>${summary}${trees}</div>`;
}
