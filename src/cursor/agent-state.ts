import fs from 'fs';
import os from 'os';
import path from 'path';
import { AGENT_TARGETS, resolveTargets, type AgentTarget } from './agent-targets';
import type { WindowUsage } from './probe-usage';
import { lastUserPromptKey, parseAgentPrompt, promptKey, type ChatLine } from './loop-guard';

export type AgentPhase =
  | 'idle'
  | 'running'
  | 'turn_pending'
  | 'turn_done'
  | 'turn_incomplete'
  | 'stuck_reconnecting'
  | 'stuck_slow'
  | 'stuck_busy'
  | 'blocked';

export type TurnVerify = 'none' | 'pending' | 'ok' | 'incomplete';

export interface AgentStateEntry {
  targetId: string;
  composerId: string;
  phase: AgentPhase;
  promptKey?: string;
  turnVerify: TurnVerify;
  issue?: string;
  since: number;
  updatedAt: number;
  busy?: boolean;
  dbStatus?: string;
  reconnecting?: boolean;
  slowCount?: number;
}

export interface AgentTransition {
  at: string;
  targetId: string;
  from?: AgentPhase;
  to: AgentPhase;
  promptKey?: string;
  note?: string;
}

interface AgentStateFile {
  agents: Record<string, AgentStateEntry>;
  log: AgentTransition[];
}

const STATE_PATH =
  process.env.CR_AGENT_STATE ||
  path.join(os.homedir(), '.cursor', 'cr-agent-state.json');

const LOG_MAX = Number(process.env.CR_AGENT_STATE_LOG_MAX) || 200;

function loadFile(): AgentStateFile {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as AgentStateFile;
    return { agents: raw.agents ?? {}, log: raw.log ?? [] };
  } catch {
    return { agents: {}, log: [] };
  }
}

function saveFile(st: AgentStateFile): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(st, null, 2));
}

export function readAgentStateFile(): AgentStateFile {
  return loadFile();
}

export function agentStatePath(): string {
  return STATE_PATH;
}

export function targetForWindowTitle(title: string): AgentTarget | null {
  const low = title.toLowerCase();
  return AGENT_TARGETS.find((t) => low.includes(t.windowHint.toLowerCase())) ?? null;
}

export function verifyTurn(messages: ChatLine[]): {
  turnVerify: TurnVerify;
  promptKey?: string;
  hint?: string;
} {
  if (!messages.length) return { turnVerify: 'none' };
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    const meta = parseAgentPrompt(messages[i].text);
    if (meta.role && meta.step) {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return { turnVerify: 'none' };
  const key = promptKey(parseAgentPrompt(messages[lastUserIdx].text));
  const last = messages[messages.length - 1];
  if (last.role === 'user') {
    return { turnVerify: 'pending', promptKey: key };
  }
  const tail = messages.slice(lastUserIdx + 1);
  const assistant = tail
    .filter((m) => m.role === 'assistant')
    .map((m) => m.text)
    .join('\n');
  if (!assistant.trim()) {
    return { turnVerify: 'pending', promptKey: key, hint: 'no assistant after prompt' };
  }
  const ok =
    /STEP=\d+/m.test(assistant) ||
    /\bcommit\b/i.test(assistant) ||
    /\d+\s+pass/i.test(assistant) ||
    assistant.length > 800;
  if (ok) return { turnVerify: 'ok', promptKey: key };
  return {
    turnVerify: 'incomplete',
    promptKey: key,
    hint: 'assistant replied but turn looks unfinished',
  };
}

export function syncAgentState(opts: {
  target: AgentTarget;
  messages: ChatLine[];
  busy: boolean;
  dbStatus?: string;
  reconnecting?: boolean;
  slowCount?: number;
  issue?: string;
}): AgentStateEntry {
  const verify = verifyTurn(opts.messages);
  const lastUserKey = lastUserPromptKey(opts.messages);
  let phase: AgentPhase = 'idle';
  let issue = opts.issue;

  if (opts.reconnecting && opts.busy) {
    phase = 'stuck_reconnecting';
    issue = issue ?? 'Reconnecting�';
  } else if ((opts.slowCount ?? 0) > 0 && opts.busy) {
    phase = 'stuck_slow';
    issue = issue ?? 'Taking longer than expected�';
  } else if (opts.busy) {
    phase = verify.turnVerify === 'pending' ? 'turn_pending' : 'running';
  } else if (verify.turnVerify === 'pending') {
    phase = 'turn_pending';
    issue = issue ?? 'user prompt not answered';
  } else if (verify.turnVerify === 'incomplete') {
    phase = 'turn_incomplete';
    issue = issue ?? verify.hint;
  } else if (verify.turnVerify === 'ok') {
    phase = 'turn_done';
  } else if (opts.dbStatus === 'aborted' && !opts.busy) {
    phase = 'idle';
    issue = issue ?? 'db aborted';
  }

  const now = Date.now();
  const st = loadFile();
  const prev = st.agents[opts.target.id];
  const entry: AgentStateEntry = {
    targetId: opts.target.id,
    composerId: opts.target.composerId,
    phase,
    promptKey: verify.promptKey ?? lastUserKey ?? undefined,
    turnVerify: verify.turnVerify,
    issue,
    since: prev?.phase === phase && prev.promptKey === (verify.promptKey ?? lastUserKey) ? prev.since : now,
    updatedAt: now,
    busy: opts.busy,
    dbStatus: opts.dbStatus,
    reconnecting: opts.reconnecting,
    slowCount: opts.slowCount,
  };

  if (!prev || prev.phase !== entry.phase || prev.promptKey !== entry.promptKey || prev.issue !== entry.issue) {
    st.log.push({
      at: new Date(now).toISOString(),
      targetId: opts.target.id,
      from: prev?.phase,
      to: entry.phase,
      promptKey: entry.promptKey,
      note: entry.issue,
    });
    if (st.log.length > LOG_MAX) st.log = st.log.slice(-LOG_MAX);
  }

  st.agents[opts.target.id] = entry;
  saveFile(st);
  return entry;
}

export function noteAgentRecover(targetId: string, note: string): void {
  const st = loadFile();
  const prev = st.agents[targetId];
  if (!prev) return;
  const now = Date.now();
  const entry: AgentStateEntry = {
    ...prev,
    phase: 'running',
    issue: undefined,
    since: now,
    updatedAt: now,
  };
  st.log.push({
    at: new Date(now).toISOString(),
    targetId,
    from: prev.phase,
    to: 'running',
    promptKey: prev.promptKey,
    note: `recover: ${note}`,
  });
  if (st.log.length > LOG_MAX) st.log = st.log.slice(-LOG_MAX);
  st.agents[targetId] = entry;
  saveFile(st);
}

export function refreshAgentStates(
  targets: AgentTarget[],
  messagesByComposer: Map<string, ChatLine[]>,
  usageWindows: WindowUsage[]
): AgentStateEntry[] {
  const out: AgentStateEntry[] = [];
  for (const t of targets) {
    const win = usageWindows.find((w) => w.windowTitle.includes(t.windowHint));
    out.push(
      syncAgentState({
        target: t,
        messages: messagesByComposer.get(t.composerId) ?? [],
        busy: win?.busy ?? false,
        reconnecting: win?.reconnecting,
        slowCount: win?.slowCount ?? undefined,
      })
    );
  }
  return out;
}

export function refreshManagedAgentStates(
  messagesByComposer: Map<string, ChatLine[]>,
  usageWindows: WindowUsage[]
): AgentStateEntry[] {
  return refreshAgentStates(resolveTargets(), messagesByComposer, usageWindows);
}

export function getAgentState(targetId?: string): {
  path: string;
  agents: AgentStateEntry[];
  log: AgentTransition[];
} {
  const st = loadFile();
  const agents = targetId
    ? st.agents[targetId]
      ? [st.agents[targetId]]
      : []
    : Object.values(st.agents);
  const log = targetId ? st.log.filter((l) => l.targetId === targetId) : st.log;
  return { path: STATE_PATH, agents, log: log.slice(-LOG_MAX) };
}
