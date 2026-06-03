import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AGENT_TARGETS } from './agent-targets';
import {
  INSTRUCTIONS_REV,
  advanceIfStepDone,
  listTracks,
  trackStepStatus,
  type AgentRole,
  type NextAgentStep,
} from './agent_next';

export interface PromptMeta {
  role?: AgentRole;
  step?: string;
  instructionsRev?: string;
  trackFile?: string;
}

export interface LoopDecision {
  allow: boolean;
  reason?: string;
  adjustedText?: string;
}

interface ComposerLoopEntry {
  lastAt?: number;
  lastKey?: string;
  lastHash?: string;
  repeatKey?: number;
}

interface OrchStateFile {
  byComposer: Record<string, ComposerLoopEntry>;
}

const ORCH_STATE =
  process.env.CR_ORCH_STATE ||
  path.join(os.homedir(), '.cursor', 'cr-orch-state.json');

const DEDUP_MS = Number(process.env.CR_ENQUEUE_DEDUP_MS) || 6 * 60_000;
const LOOP_MS = Number(process.env.CR_ENQUEUE_LOOP_MS) || 2 * 60 * 60_000;
const LOOP_REPEAT = Number(process.env.CR_ENQUEUE_LOOP_MAX) || 2;

export function agentDirForComposer(composerId: string): string | null {
  return AGENT_TARGETS.find((t) => t.composerId === composerId)?.agentDir ?? null;
}

export function parseAgentPrompt(text: string): PromptMeta {
  const role = text.match(/^ROLE=(\w+)/m)?.[1] as AgentRole | undefined;
  const step = text.match(/^STEP=(\S+)/m)?.[1];
  const instructionsRev = text.match(/^INSTRUCTIONS_REV=(\S+)/m)?.[1];
  const trackFile = text.match(/@docs\/agent\/(TRACK_\w+\.md)/m)?.[1];
  return { role, step, instructionsRev, trackFile };
}

export function promptKey(meta: PromptMeta): string {
  const track = meta.trackFile ? `:${meta.trackFile.replace('TRACK_', '').replace('.md', '')}` : '';
  return `${meta.role ?? '?'}:${meta.step ?? '?'}${track}`;
}

export function hashPrompt(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
}

export function readInstructionsRev(agentDir: string | null | undefined): string {
  if (!agentDir) return INSTRUCTIONS_REV;
  try {
    const m = fs
      .readFileSync(path.join(agentDir, 'CONTINUITY.md'), 'utf8')
      .match(/\*\*INSTRUCTIONS_REV:\*\*\s*`([^`]+)`/);
    return m?.[1] ?? INSTRUCTIONS_REV;
  } catch {
    return INSTRUCTIONS_REV;
  }
}

export function fixInstructionsRev(text: string, agentDir?: string | null): string {
  if (!/^INSTRUCTIONS_REV=/m.test(text)) return text;
  const rev = readInstructionsRev(agentDir);
  return text.replace(/^INSTRUCTIONS_REV=\S+/m, `INSTRUCTIONS_REV=${rev}`);
}

function loadOrchState(): OrchStateFile {
  try {
    return JSON.parse(fs.readFileSync(ORCH_STATE, 'utf8')) as OrchStateFile;
  } catch {
    return { byComposer: {} };
  }
}

function saveOrchState(st: OrchStateFile): void {
  fs.mkdirSync(path.dirname(ORCH_STATE), { recursive: true });
  fs.writeFileSync(ORCH_STATE, JSON.stringify(st, null, 2));
}

type ChatLine = { role: string; text: string };

export type { ChatLine };

export function syncOrchFromChat(composerId: string, messages?: ChatLine[]): void {
  if (!messages?.length) return;
  const last = messages[messages.length - 1];
  const lastUserKey = lastUserPromptKey(messages);
  if (!lastUserKey) return;
  const state = loadOrchState();
  const entry = state.byComposer[composerId];
  if (!entry) return;
  if (last.role === 'assistant' && entry.lastKey === lastUserKey) {
    state.byComposer[composerId] = { ...entry, repeatKey: 0 };
    saveOrchState(state);
  }
}

export function isExpectedLoopBlock(reason?: string): boolean {
  if (!reason) return false;
  return /waiting in chat|already queued|duplicate enqueue|already sent|already answered|already ran|turn pending/i.test(
    reason
  );
}

export function lastUserPromptKey(messages: ChatLine[]): string | null {
  const users = messages.filter((m) => m.role === 'user');
  for (let i = users.length - 1; i >= 0; i--) {
    const meta = parseAgentPrompt(users[i].text);
    if (meta.role && meta.step) return promptKey(meta);
  }
  return null;
}

export function countRecentSameKey(messages: ChatLine[], key: string, tail = 8): number {
  return messages
    .filter((m) => m.role === 'user')
    .slice(-tail)
    .filter((m) => promptKey(parseAgentPrompt(m.text)) === key).length;
}

function checkHistoryAndPending(
  key: string,
  messages?: ChatLine[],
  pendingTexts?: string[],
  source?: 'agent' | 'guard' | 'mcp'
): LoopDecision | null {
  if (messages?.length) {
    const lastMsg = messages[messages.length - 1];
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      const lastUserKey = promptKey(parseAgentPrompt(lastUser.text));
      if (lastUserKey === key && lastMsg.role === 'user') {
        return { allow: false, reason: `same step waiting in chat (${key})` };
      }
      if (lastUserKey === key && lastMsg.role === 'assistant') {
        return {
          allow: false,
          reason: `step ${key} already ran; enqueue next STEP`,
        };
      }
    }
    const tail = source === 'guard' ? 6 : 8;
    const n = countRecentSameKey(messages, key, tail);
    const maxSame = source === 'guard' ? 1 : 2;
    if (n >= maxSame) {
      return { allow: false, reason: `step ${key} already sent ${n}x in chat` };
    }
  }
  if (pendingTexts?.length) {
    for (const t of pendingTexts) {
      if (promptKey(parseAgentPrompt(t)) === key) {
        return { allow: false, reason: `step ${key} already queued` };
      }
    }
  }
  return null;
}

export function checkEnqueueLoop(opts: {
  composerId: string;
  text: string;
  agentDir?: string | null;
  historyMessages?: ChatLine[];
  pendingTexts?: string[];
  source?: 'agent' | 'guard' | 'mcp';
}): LoopDecision {
  syncOrchFromChat(opts.composerId, opts.historyMessages);
  const agentDir = opts.agentDir ?? agentDirForComposer(opts.composerId);
  let adjustedText = fixInstructionsRev(opts.text.trim(), agentDir);
  const meta = parseAgentPrompt(adjustedText);

  if (agentDir && meta.role === 'Driver' && meta.step && /^\d+$/.test(meta.step)) {
    const trackFile = meta.trackFile ?? listTracks(agentDir).find((t) => t.inProgress)?.file;
    if (trackFile) {
      const st = trackStepStatus(path.join(agentDir, trackFile), meta.step);
      if (st === 'done') {
        const advanced = advanceIfStepDone(agentDir, {
          role: 'Driver',
          step: meta.step,
          trackFile,
          focus: 'stability',
          reason: '',
          refs: [],
        });
        if (advanced.step !== meta.step) {
          adjustedText = adjustedText
            .replace(/^STEP=\S+/m, `STEP=${advanced.step}`)
            .replace(/@docs\/agent\/TRACK_\w+\.md/m, `@docs/agent/${advanced.trackFile}`);
        }
      }
    }
  }

  const key = promptKey(parseAgentPrompt(adjustedText));
  const hist = checkHistoryAndPending(
    key,
    opts.historyMessages,
    opts.pendingTexts,
    opts.source
  );
  if (hist) return hist;

  const state = loadOrchState();
  const entry = state.byComposer[opts.composerId] ?? {};
  const now = Date.now();

  if (
    entry.lastKey === key &&
    entry.lastAt != null &&
    now - entry.lastAt < DEDUP_MS
  ) {
    return { allow: false, reason: `duplicate enqueue (${key})` };
  }

  if (
    entry.lastKey === key &&
    (entry.repeatKey ?? 0) >= LOOP_REPEAT &&
    entry.lastAt != null &&
    now - entry.lastAt < LOOP_MS
  ) {
    return { allow: false, reason: `step loop (${key})` };
  }

  return { allow: true, adjustedText };
}

export function recordEnqueue(composerId: string, text: string): void {
  const meta = parseAgentPrompt(text);
  const key = promptKey(meta);
  const h = hashPrompt(text);
  const state = loadOrchState();
  const prev = state.byComposer[composerId] ?? {};
  const now = Date.now();
  state.byComposer[composerId] = {
    lastAt: now,
    lastKey: key,
    lastHash: h,
    repeatKey: prev.lastKey === key ? (prev.repeatKey ?? 0) + 1 : 0,
  };
  saveOrchState(state);
}

export function readOrchState(): OrchStateFile {
  return loadOrchState();
}
