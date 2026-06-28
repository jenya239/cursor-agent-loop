import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AGENT_TARGETS } from './agent-targets';
import {
  advanceIfStepDone,
  INSTRUCTIONS_REV,
  listTracks,
  trackStepStatus,
  type NextAgentStep,
} from './agent_next';
import {
  checkHistoryAndPending,
  checkOrchDedup,
  isExpectedLoopBlock,
} from '../orchestration/guard/enqueue-policy';
import {
  parseAgentPrompt,
  promptKey,
  lastUserPromptKey,
  countRecentSameKey,
} from '../orchestration/guard/prompt-meta';

export type { ChatLine } from '../orchestration/types';
export type { PromptMeta } from '../orchestration/guard/prompt-meta';
export {
  parseAgentPrompt,
  promptKey,
  lastUserPromptKey,
  countRecentSameKey,
  isExpectedLoopBlock,
};
export { isExpectedSendBlock } from '../orchestration/guard/enqueue-policy';

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
  const dedup = checkOrchDedup(key, entry, Date.now(), {
    dedupMs: DEDUP_MS,
    loopMs: LOOP_MS,
    loopRepeat: LOOP_REPEAT,
  });
  if (dedup) return dedup;

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
