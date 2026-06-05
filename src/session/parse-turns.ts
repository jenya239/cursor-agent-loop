import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { SessionTurn } from '../progress/report';

const LOG_PATH = process.env.CR_OVERNIGHT_LOG ?? `${process.env.HOME ?? ''}/.cursor/cr-overnight.log`;

function logTimesByTurn(logPath = LOG_PATH): Map<string, string> {
  const result = new Map<string, string>();
  try {
    const text = fs.readFileSync(logPath, 'utf8');
    for (const line of text.split('\n')) {
      if (!line.includes('"sent"')) continue;
      try {
        const entry = JSON.parse(line) as { msg?: string; role?: string; step?: string; at?: string };
        if (entry.msg !== 'sent' || !entry.role || !entry.step || !entry.at) continue;
        const match = String(entry.at).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
        if (!match) continue;
        const key = `${match[1]}|${entry.role}|${entry.step}`;
        if (!result.has(key)) result.set(key, match[2]);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ignore */
  }
  return result;
}

function sessionGitTimesByDate(agentDir: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  try {
    const repositoryDirectory = path.join(agentDir, '../..');
    const relativePath = path.relative(repositoryDirectory, path.join(agentDir, 'SESSION.md'));
    const output = execSync(
      `git -C "${repositoryDirectory}" log --format="%ai" -- "${relativePath}"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
    );
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
      if (!match) continue;
      const [, date, time] = match;
      if (!result.has(date)) result.set(date, []);
      result.get(date)!.push(time);
    }
  } catch {
    /* ignore */
  }
  return result;
}

function getField(block: string, key: string): string {
  const match = block.match(new RegExp(`\\|\\s*${key}\\s*\\|\\s*([^|\n]+)`));
  return match?.[1]?.trim().replace(/\*\*/g, '') ?? '';
}

export function parseSessionTurnBlocks(content: string, options?: {
  agentDir?: string;
  logPath?: string;
  limit?: number;
}): SessionTurn[] {
  const limit = options?.limit ?? 25;
  const stripped = content.split(/^---\s*$/m)[0] ?? content;
  const blocks = stripped.split(/^### Turn /m).slice(1);
  const gitByDate = options?.agentDir ? sessionGitTimesByDate(options.agentDir) : new Map<string, string[]>();
  const logTimes = logTimesByTurn(options?.logPath);
  const dateIndex = new Map<string, number>();
  const recent = blocks.slice(-(limit * 2)).reverse();
  const turns = recent
    .map((block) => {
      const title = block.split('\n')[0]?.trim() ?? '';
      const dateMatch = title.match(/^(\d{4}-\d{2}-\d{2})/);
      const turnDate = dateMatch?.[1] ?? '';
      let role = getField(block, 'role');
      if (!role || role.includes('<') || role.includes('/')) {
        const match = title.match(
          /\((Driver|Critic|Planner|Meta|Cleaner|Backlog|Orchestrator|Researcher|Auditor|Blogger|Reviewer|Scribe)\b/
        );
        role = match?.[1] ?? role;
      }
      if (!role) {
        const stepValue = getField(block, 'step');
        if (/^\d+/.test(stepValue)) role = 'Driver';
      }
      const done = getField(block, 'done');
      if (!done || done.startsWith('<') || done.includes('Driver / Planner')) return null;
      const gate = getField(block, 'gate') || getField(block, 'verify') || getField(block, 'result');
      let date = turnDate;
      if (turnDate) {
        const gitTimes = gitByDate.get(turnDate) ?? [];
        const index = dateIndex.get(turnDate) ?? 0;
        if (gitTimes[index]) {
          date = `${turnDate} ${gitTimes[index]}`;
          dateIndex.set(turnDate, index + 1);
        } else {
          const logKey = `${turnDate}|${role}|${getField(block, 'step')}`;
          const logTime = logTimes.get(logKey);
          if (logTime) date = `${turnDate} ${logTime}`;
        }
      }
      return { date, title, role, step: getField(block, 'step'), done, gate } as SessionTurn;
    })
    .filter((turn): turn is SessionTurn => turn !== null);
  return turns.slice(0, limit);
}

export function parseSessionTurnsFromFile(sessionPath: string, options?: {
  agentDir?: string;
  logPath?: string;
  limit?: number;
}): SessionTurn[] {
  try {
    const content = fs.readFileSync(sessionPath, 'utf8');
    const agentDirectory = options?.agentDir ?? path.dirname(sessionPath);
    return parseSessionTurnBlocks(content, { ...options, agentDir: agentDirectory });
  } catch {
    return [];
  }
}

export function workspaceFromAgentDir(agentDir: string): string {
  const normalized = agentDir.replace(/\\/g, '/');
  if (normalized.includes('/mlc/docs/agent')) return 'mlc';
  if (normalized.endsWith('/cr/docs/agent') || normalized.endsWith('/docs/agent')) return 'cr';
  return path.basename(path.dirname(path.dirname(agentDir)));
}
