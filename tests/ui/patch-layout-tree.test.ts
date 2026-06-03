/** @jest-environment jsdom */

import {
  applyLayoutPanel,
  collectLayoutOpenState,
  patchLayoutTree,
} from '../../src/ui/views/patch-layout-tree';
import type { CursorLayoutSnapshot, LayoutNode } from '../../src/cursor/layout/types';

function win(targetId: string, title: string, tree: LayoutNode): CursorLayoutSnapshot['windows'][number] {
  return { targetId, title, url: '', shell: 'workbench-v2', kind: 'editor-workbench', tree };
}

function snap(opts: {
  at?: number;
  draftLen?: number;
  windows?: CursorLayoutSnapshot['windows'];
  cdpOk?: boolean;
}): CursorLayoutSnapshot {
  const draftLen = opts.draftLen ?? 0;
  return {
    at: opts.at ?? 1,
    cdpOk: opts.cdpOk ?? true,
    windows: opts.windows ?? [
      win('win1', 'mlc - Cursor', {
        id: 'win1',
        label: 'mlc - Cursor',
        kind: 'window',
        children: [
          {
            id: 'bar',
            label: 'composer-bar',
            kind: 'composer-bar',
            state: 'idle',
            children: [
              {
                id: 'inp',
                label: `input: editable ${draftLen}ch`,
                kind: 'composer-input',
                state: 'editable',
              },
            ],
          },
        ],
      }),
    ],
  };
}

describe('collectLayoutOpenState', () => {
  it('collects open flags for all details', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <details data-lid="a" open></details>
      <details data-lid="b"></details>
    `;
    const m = collectLayoutOpenState(container);
    expect(m.get('a')).toBe(true);
    expect(m.get('b')).toBe(false);
  });
});

describe('patchLayoutTree', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('initial render creates layout root', () => {
    patchLayoutTree(container, snap({ draftLen: 0 }));
    expect(container.querySelector('[data-layout-root]')).toBeTruthy();
    expect(container.textContent).toContain('input: editable 0ch');
  });

  it('second patch updates text without replacing root', () => {
    patchLayoutTree(container, snap({ draftLen: 0 }));
    const root = container.querySelector('[data-layout-root]')!;
    patchLayoutTree(container, snap({ draftLen: 42 }), undefined, collectLayoutOpenState(container));
    expect(container.querySelector('[data-layout-root]')).toBe(root);
    expect(container.textContent).toContain('input: editable 42ch');
  });

  it('preserves collapsed details state', () => {
    patchLayoutTree(container, snap({ draftLen: 0 }));
    const bar = container.querySelector('details[data-lid="bar"]') as HTMLDetailsElement;
    bar.open = false;
    patchLayoutTree(container, snap({ draftLen: 5 }), undefined, collectLayoutOpenState(container));
    expect((container.querySelector('details[data-lid="bar"]') as HTMLDetailsElement).open).toBe(false);
  });

  it('updates summary timestamp in place', () => {
    patchLayoutTree(container, snap({ at: 1000 }));
    const summary = container.querySelector('[data-layout-part="summary"]')!;
    expect(summary.innerHTML).toContain('1970');
    patchLayoutTree(container, snap({ at: 2000 }), undefined, collectLayoutOpenState(container));
    expect(summary.innerHTML).toContain('1970-01-01T00:00:02.000Z');
  });

  it('adds and removes window sections incrementally', () => {
    patchLayoutTree(container, snap({}));
    expect(container.querySelectorAll('section.lw')).toHaveLength(1);
    patchLayoutTree(
      container,
      snap({
        windows: [
          win('win1', 'mlc - Cursor', { id: 'win1', label: 'mlc', kind: 'window' }),
          win('win2', 'Agents', { id: 'win2', label: 'Agents', kind: 'window' }),
        ],
      }),
      undefined,
      collectLayoutOpenState(container)
    );
    expect(container.querySelectorAll('section.lw')).toHaveLength(2);
    patchLayoutTree(container, snap({}), undefined, collectLayoutOpenState(container));
    expect(container.querySelectorAll('section.lw')).toHaveLength(1);
    expect(container.querySelector('[data-window-id="win2"]')).toBeNull();
  });

  it('removes stale child nodes', () => {
    patchLayoutTree(container, snap({ draftLen: 0 }));
    expect(container.querySelector('[data-lid="inp"]')).toBeTruthy();
    patchLayoutTree(
      container,
      snap({
        windows: [
          win('win1', 'mlc - Cursor', {
            id: 'win1',
            label: 'mlc - Cursor',
            kind: 'window',
            children: [{ id: 'bar', label: 'composer-bar', kind: 'composer-bar' }],
          }),
        ],
      }),
      undefined,
      collectLayoutOpenState(container)
    );
    expect(container.querySelector('[data-lid="inp"]')).toBeNull();
  });

  it('replaces content on error', () => {
    patchLayoutTree(container, snap({}));
    patchLayoutTree(container, null, 'cdp fail');
    expect(container.querySelector('[data-layout-root]')).toBeNull();
    expect(container.textContent).toContain('cdp fail');
  });

  it('replaces content when cdpOk false', () => {
    patchLayoutTree(container, snap({}));
    patchLayoutTree(container, { at: 1, cdpOk: false, windows: [] });
    expect(container.textContent).toContain('CDP nedostupen');
  });
});

describe('applyLayoutPanel', () => {
  it('wraps patch with open-state collection', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    applyLayoutPanel(container, snap({ draftLen: 0 }));
    const bar = container.querySelector('details[data-lid="bar"]') as HTMLDetailsElement;
    bar.open = false;
    applyLayoutPanel(container, snap({ draftLen: 9 }));
    expect((container.querySelector('details[data-lid="bar"]') as HTMLDetailsElement).open).toBe(false);
    expect(container.textContent).toContain('input: editable 9ch');
    container.remove();
  });
});
