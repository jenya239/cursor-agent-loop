import os from 'os';
import path from 'path';

export function defaultCursorUserDir(): string {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Cursor', 'User');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Cursor', 'User');
  }
  return path.join(home, '.config', 'Cursor', 'User');
}

export function globalDbPath(userDir = defaultCursorUserDir()): string {
  return path.join(userDir, 'globalStorage', 'state.vscdb');
}

export function workspaceStorageDir(userDir = defaultCursorUserDir()): string {
  return path.join(userDir, 'workspaceStorage');
}
