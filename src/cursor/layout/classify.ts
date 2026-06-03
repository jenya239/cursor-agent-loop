import { isAgentsWindowTitle } from '../../cdp/window-match';
import type { CursorUiShell, CursorWindowKind } from './types';

const SKIP = /walkthrough|welcome|release notes/i;
const SETTINGS = /Cursor Settings/i;

export function classifyWindow(
  title: string,
  url: string
): { shell: CursorUiShell; kind: CursorWindowKind } {
  const t = (title || '').trim();
  if (isAgentsWindowTitle(t)) return { shell: 'agents-v3', kind: 'agents-dedicated' };
  if (SETTINGS.test(t)) return { shell: 'settings', kind: 'settings' };
  if (SKIP.test(t)) return { shell: 'unknown', kind: 'walkthrough' };
  if ((url || '').includes('workbench.html')) return { shell: 'workbench-v2', kind: 'editor-workbench' };
  return { shell: 'unknown', kind: 'other' };
}
