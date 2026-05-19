import { pickWorkbenchPage, workbenchPages } from '../src/cdp/client';
import type { CdpTarget } from '../src/cdp/client';

const targets: CdpTarget[] = [
  {
    id: '1',
    type: 'page',
    title: 'Cursor Settings - mlc - Cursor',
    url: 'vscode-file://app/workbench.html',
    webSocketDebuggerUrl: 'ws://a',
  },
  {
    id: '2',
    type: 'page',
    title: 'cr - cr - Cursor',
    url: 'vscode-file://app/workbench.html',
    webSocketDebuggerUrl: 'ws://b',
  },
];

describe('pickWorkbenchPage', () => {
  it('skips Settings and prefers cr window', () => {
    expect(pickWorkbenchPage(targets)?.title).toBe('cr - cr - Cursor');
  });

  it('prefers CDP_WINDOW_TITLE', () => {
    process.env.CDP_WINDOW_TITLE = 'nord';
    expect(pickWorkbenchPage([...targets, {
      id: '3',
      type: 'page',
      title: 'schema.json - nord (Workspace) - Cursor',
      url: 'vscode-file://app/workbench.html',
      webSocketDebuggerUrl: 'ws://c',
    }])?.title).toContain('nord');
    delete process.env.CDP_WINDOW_TITLE;
  });

  it('workbenchPages filters type page', () => {
    expect(workbenchPages(targets)).toHaveLength(2);
  });
});
