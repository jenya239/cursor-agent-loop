import { renderLayoutTreeHtml, renderNodeHeadHtml } from '../../src/ui/views/render-layout-tree';

describe('renderLayoutTreeHtml', () => {
  it('renders tree with shell labels', () => {
    const html = renderLayoutTreeHtml({
      at: 1,
      cdpOk: true,
      windows: [
        {
          targetId: 'page-agents',
          title: 'Cursor Agents',
          url: 'workbench.html',
          shell: 'agents-v3',
          kind: 'agents-dedicated',
          tree: {
            id: 'pageagents',
            label: 'Cursor Agents',
            kind: 'window',
            state: 'agents-v3',
            children: [
              {
                id: 'a1',
                label: 'agents-sidebar',
                kind: 'sidebar',
                children: [
                  {
                    id: 'a2',
                    label: 'mlc supervisor',
                    kind: 'agent-item',
                    state: 'active',
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(html).toContain('agents-v3');
    expect(html).toContain('mlc supervisor');
    expect(html).toContain('<details');
  });

  it('emits stable ids for patch diff', () => {
    const html = renderLayoutTreeHtml({
      at: 1,
      cdpOk: true,
      windows: [
        {
          targetId: 'page-cr',
          title: 'cr - Cursor',
          url: '',
          shell: 'workbench-v2',
          kind: 'editor-workbench',
          tree: {
            id: 'pagecr',
            label: 'cr',
            kind: 'window',
            children: [{ id: 'bar1', label: 'composer-bar', kind: 'composer-bar' }],
          },
        },
      ],
    });
    expect(html).toContain('data-layout-root');
    expect(html).toContain('data-window-id="page-cr"');
    expect(html).toContain('data-lid="pagecr"');
    expect(html).toContain('data-lid="bar1"');
  });
});

describe('renderNodeHeadHtml', () => {
  it('includes kind state and attrs', () => {
    const html = renderNodeHeadHtml({
      id: 'x',
      label: 'composer-bar',
      kind: 'composer-bar',
      state: 'busy',
      attrs: { role: 'supervisor' },
    });
    expect(html).toContain('composer-bar');
    expect(html).toContain('busy');
    expect(html).toContain('role=supervisor');
  });
});
