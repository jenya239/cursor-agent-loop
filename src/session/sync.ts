import fs from 'fs';
import path from 'path';
import {
  listSessionTurnsFromDatabase,
  replaceWorkspaceTurns,
  sessionTurnToRecord,
} from '../db/turns';
import type { SessionTurn } from '../progress/report';
import {
  parseSessionTurnsFromFile,
  workspaceFromAgentDir,
} from './parse-turns';

export function syncSessionTurnsFromAgentDir(
  agentDir: string,
  options?: { databasePath?: string; limit?: number }
): number {
  const sessionPath = path.join(agentDir, 'SESSION.md');
  const workspace = workspaceFromAgentDir(agentDir);
  const turns = parseSessionTurnsFromFile(sessionPath, {
    agentDir,
    limit: options?.limit ?? 100,
  });
  const records = turns.map((turn) => sessionTurnToRecord(workspace, turn));
  return replaceWorkspaceTurns(workspace, records, options?.databasePath);
}

export function loadCachedSessionTurns(
  agentDir: string,
  options?: { databasePath?: string; limit?: number }
): SessionTurn[] {
  const workspace = workspaceFromAgentDir(agentDir);
  const cached = listSessionTurnsFromDatabase({
    workspace,
    limit: options?.limit ?? 25,
    databasePath: options?.databasePath,
  });
  if (cached.length > 0) return cached;
  syncSessionTurnsFromAgentDir(agentDir, options);
  return listSessionTurnsFromDatabase({
    workspace,
    limit: options?.limit ?? 25,
    databasePath: options?.databasePath,
  });
}

export type SessionTurnsWatcher = {
  stop: () => void;
};

export function startSessionTurnsWatcher(
  agentDir: string,
  options?: {
    databasePath?: string;
    debounceMilliseconds?: number;
    watchFile?: typeof fs.watch;
  }
): SessionTurnsWatcher {
  const sessionPath = path.join(agentDir, 'SESSION.md');
  const debounceMilliseconds = options?.debounceMilliseconds ?? 300;
  const watchFile = options?.watchFile ?? fs.watch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: fs.FSWatcher | undefined;

  const scheduleSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      syncSessionTurnsFromAgentDir(agentDir, { databasePath: options?.databasePath });
    }, debounceMilliseconds);
  };

  syncSessionTurnsFromAgentDir(agentDir, { databasePath: options?.databasePath });

  try {
    watcher = watchFile(sessionPath, scheduleSync);
  } catch {
    /* SESSION.md may not exist yet */
  }

  return {
    stop() {
      if (timer) clearTimeout(timer);
      watcher?.close();
    },
  };
}
