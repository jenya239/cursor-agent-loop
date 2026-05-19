import fs from 'fs';
import path from 'path';
import { workspaceStorageDir } from './paths';

export interface WorkspaceInfo {
  workspaceId: string;
  path: string;
  label: string;
}

export interface WorkspaceUriLike {
  fsPath?: string;
  path?: string;
  external?: string;
  authority?: string;
  scheme?: string;
}

export function workspaceLabelFromPath(folderPath: string): string {
  const p = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
  if (!p) return '—';
  const base = p.split('/').filter(Boolean).pop() || p;
  if (p.includes('vscode-remote://') || p.includes('ssh-remote')) {
    try {
      const u = new URL(p.replace('vscode-remote://', 'https://'));
      const host = u.hostname || u.pathname.split('/')[1] || 'remote';
      const tail = u.pathname.split('/').filter(Boolean).pop();
      return tail ? `${host}/${tail}` : host;
    } catch {
      return base;
    }
  }
  return base;
}

export function parseWorkspaceUri(uri: WorkspaceUriLike | string | undefined): { path: string; label: string } {
  if (!uri) return { path: '', label: '—' };
  if (typeof uri === 'string') {
    return { path: uri, label: workspaceLabelFromPath(uri) };
  }
  const folder = uri.fsPath || uri.path || uri.external || '';
  if (!folder) return { path: '', label: '—' };
  return { path: folder, label: workspaceLabelFromPath(folder) };
}

export function loadWorkspaceIndex(userDir?: string): Map<string, WorkspaceInfo> {
  const dir = workspaceStorageDir(userDir);
  const map = new Map<string, WorkspaceInfo>();
  if (!fs.existsSync(dir)) return map;

  for (const id of fs.readdirSync(dir)) {
    const jsonPath = path.join(dir, id, 'workspace.json');
    if (!fs.existsSync(jsonPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
        folder?: string;
        workspace?: string;
      };
      const folder = raw.folder || raw.workspace || '';
      if (!folder) continue;
      const { path: folderPath, label } = parseWorkspaceUri(folder);
      map.set(id, { workspaceId: id, path: folderPath, label });
    } catch {
      /* skip */
    }
  }
  return map;
}

export function resolveWorkspace(
  workspaceId: string | undefined,
  uri: WorkspaceUriLike | undefined,
  index: Map<string, WorkspaceInfo>
): WorkspaceInfo {
  const id = workspaceId ?? '';
  const fromUri = parseWorkspaceUri(uri);
  if (fromUri.path) {
    return { workspaceId: id, path: fromUri.path, label: fromUri.label };
  }
  if (id && index.has(id)) {
    return index.get(id)!;
  }
  if (id && /^\d{10,}$/.test(id)) {
    return { workspaceId: id, path: '', label: 'без проекта' };
  }
  return { workspaceId: id, path: '', label: '—' };
}
