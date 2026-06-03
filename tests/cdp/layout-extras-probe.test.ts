import { parseLayoutExtrasProbe } from '../../src/cdp/probes/layout-extras.v1';

describe('parseLayoutExtrasProbe', () => {
  it('parses thread turns and tool calls', () => {
    const p = parseLayoutExtrasProbe({
      thread: {
        turnCount: 2,
        slowCount: 1,
        activeTool: 'Worked for 3s',
        turns: [
          {
            preview: 'hello',
            slow: false,
            toolCalls: [{ label: 'FinishedRead foo.ts', state: 'finished', detail: 'foo.ts' }],
          },
        ],
      },
      blockers: { blockers: [], sendBlocked: false },
      header: { title: 't', environment: 'local', workspace: 'mlc', pills: [], menuActions: [] },
      panelContent: { open: true, activeTab: 'Terminal', tabs: [{ label: 'Terminal', active: true }], problemsCount: 0, terminalCount: 1 },
      editorArea: { groupCount: 2, activeTab: 'a.ts', reviewOpen: true, reviewPreview: 'diff' },
    });
    expect(p.thread.activeTool).toBe('Worked for 3s');
    expect(p.thread.turns[0]?.toolCalls[0]?.state).toBe('finished');
    expect(p.panelContent.terminalCount).toBe(1);
    expect(p.editorArea.reviewOpen).toBe(true);
  });

  it('parses blockers', () => {
    const p = parseLayoutExtrasProbe({
      blockers: {
        blockers: [{ kind: 'revert', label: 'Revert?', blocking: true }],
        sendBlocked: true,
      },
    });
    expect(p.blockers.sendBlocked).toBe(true);
    expect(p.blockers.blockers[0]?.kind).toBe('revert');
  });

  it('parses header pills', () => {
    const p = parseLayoutExtrasProbe({
      header: {
        title: 'Agent in mlc',
        environment: 'cloud',
        workspace: 'mlc',
        pills: [{ label: '1 Terminal', kind: 'terminal', aria: 'Open terminals (1)' }],
        menuActions: ['New Agent'],
      },
    });
    expect(p.header.pills[0]?.kind).toBe('terminal');
    expect(p.header.menuActions).toEqual(['New Agent']);
  });

  it('returns empty on garbage', () => {
    expect(parseLayoutExtrasProbe(null).thread.turnCount).toBe(0);
  });
});
