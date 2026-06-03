import type { CursorLayoutSnapshot, LayoutNode } from '../../cursor/layout/types';
import { esc } from './dom';
import { renderLayoutTreeHtml, renderNodeHeadHtml } from './render-layout-tree';

function qid(id: string): string {
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function collectLayoutOpenState(root: ParentNode): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const el of root.querySelectorAll('details[data-lid]')) {
    const lid = (el as HTMLDetailsElement).dataset.lid;
    if (lid) out.set(lid, (el as HTMLDetailsElement).open);
  }
  return out;
}

function defaultOpen(lid: string, openState: Map<string, boolean>): boolean {
  return openState.has(lid) ? openState.get(lid)! : true;
}

function setHead(el: HTMLElement, node: LayoutNode): void {
  const html = renderNodeHeadHtml(node);
  if (el.tagName === 'DETAILS') {
    const summary = el.querySelector(':scope > summary');
    if (summary && summary.innerHTML !== html) summary.innerHTML = html;
    return;
  }
  if (el.innerHTML !== html) el.innerHTML = html;
}

function patchNode(
  parent: HTMLElement,
  node: LayoutNode,
  depth: number,
  openState: Map<string, boolean>
): HTMLElement {
  const pad = depth * 12;
  const sel = `:scope > [data-lid="${qid(node.id)}"]`;
  let el = parent.querySelector(sel) as HTMLElement | null;
  const hasChildren = !!node.children?.length;

  if (!hasChildren) {
    if (!el || el.tagName !== 'DIV') {
      el?.remove();
      el = document.createElement('div');
      el.className = 'ln';
      el.dataset.lid = node.id;
      parent.appendChild(el);
    }
    el.style.paddingLeft = `${pad}px`;
    setHead(el, node);
    return el;
  }

  if (!el || el.tagName !== 'DETAILS') {
    el?.remove();
    el = document.createElement('details');
    el.className = 'ln';
    el.dataset.lid = node.id;
    el.appendChild(document.createElement('summary'));
    parent.appendChild(el);
  }
  el.style.paddingLeft = `${pad}px`;
  setHead(el, node);
  (el as HTMLDetailsElement).open = defaultOpen(node.id, openState);

  const keep = new Set(node.children!.map((c) => c.id));
  for (const child of [...el.querySelectorAll(':scope > [data-lid]')]) {
    if (!keep.has((child as HTMLElement).dataset.lid!)) child.remove();
  }
  for (const child of node.children!) {
    el.appendChild(patchNode(el, child, depth + 1, openState));
  }
  return el;
}

function patchWindowSection(
  root: HTMLElement,
  w: CursorLayoutSnapshot['windows'][number],
  openState: Map<string, boolean>
): void {
  const sel = `:scope > section.lw[data-window-id="${qid(w.targetId)}"]`;
  let section = root.querySelector(sel) as HTMLElement | null;
  if (!section) {
    section = document.createElement('section');
    section.className = 'lw';
    section.dataset.windowId = w.targetId;
    section.innerHTML = `<div class="lw-head"></div><div class="layout-tree"></div>`;
    root.appendChild(section);
  }
  const head = section.querySelector('.lw-head')!;
  const headHtml = `${esc(w.title)} � <code>${esc(w.shell)}</code> � ${esc(w.kind)}`;
  if (head.innerHTML !== headHtml) head.innerHTML = headHtml;

  const tree = section.querySelector('.layout-tree') as HTMLElement;
  const keep = new Set(collectIds(w.tree));
  for (const child of [...tree.querySelectorAll(':scope > [data-lid]')]) {
    if (!keep.has((child as HTMLElement).dataset.lid!)) child.remove();
  }
  patchNode(tree, w.tree, 0, openState);
}

function collectIds(node: LayoutNode): string[] {
  const out = [node.id];
  for (const c of node.children || []) out.push(...collectIds(c));
  return out;
}

/** Incremental DOM update: keeps details open/closed and avoids full innerHTML replace. */
export function patchLayoutTree(
  container: HTMLElement,
  snap: CursorLayoutSnapshot | null,
  err?: string,
  openState: Map<string, boolean> = new Map()
): void {
  if (err || !snap || !snap.cdpOk || !snap.windows.length) {
    container.innerHTML = renderLayoutTreeHtml(snap, err);
    return;
  }

  let root = container.querySelector('[data-layout-root]') as HTMLElement | null;
  if (!root) {
    container.innerHTML = renderLayoutTreeHtml(snap);
    return;
  }

  const summary = root.querySelector('[data-layout-part="summary"]');
  if (summary) {
    summary.innerHTML = `okon ${snap.windows.length} &middot; ${new Date(snap.at).toISOString()}`;
  }

  const keepWindows = new Set(snap.windows.map((w) => w.targetId));
  for (const section of [...root.querySelectorAll(':scope > section.lw[data-window-id]')]) {
    const id = (section as HTMLElement).dataset.windowId;
    if (id && !keepWindows.has(id)) section.remove();
  }

  for (const w of snap.windows) {
    patchWindowSection(root, w, openState);
  }
}

export function applyLayoutPanel(
  container: HTMLElement,
  snap: CursorLayoutSnapshot | null,
  err?: string
): void {
  patchLayoutTree(container, snap, err, collectLayoutOpenState(container));
}
