import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { ChatStore } from '../src/chat-store';
import { CursorModel } from '../src/cursor/cursor-model';
import { liveCdp } from '../src/cdp/live-cdp';
import { CursorDbReader } from '../src/db/reader';
import { globalDbPath } from '../src/db/paths';
import { buildNudgePrompt, recordGuardNudge, pickNextAgentStep } from '../src/cursor/agent_next';
import { parseAgentPrompt } from '../src/cursor/loop-guard';
import { buildGuardRecovery, planGuardNudge, isExpectedSendBlock } from '../src/cursor/guard-nudge';
import { syncAgentState } from '../src/cursor/agent-state';
import { analyzeSupervisor, guardBlockedAlerts, loadSupervisorReport } from '../src/supervisor/analyze';
import { resolveTargets, type AgentTarget } from '../src/cursor/agent-targets';
import { sendKeys, capturePaneOutput } from '../src/tmux/panes';
import { isExpensiveModel, probeWindowUsage } from './probe-usage';
const CR_BASE = process.env.CR_BASE || 'http://127.0.0.1:3847';
const LOG = process.env.CR_OVERNIGHT_LOG || path.join(os.homedir(), '.cursor', 'cr-overnight.log');
const STATE = path.join(path.dirname(LOG), 'cr-overnight-state.json');
const COOLDOWN_MS = Number(process.env.CR_OVERNIGHT_COOLDOWN_MS) || 15 * 60_000;
const USAGE_PAUSE_PCT = Number(process.env.CR_USAGE_PAUSE_PCT) || 100;
const REPO = path.join(__dirname, '..');

type StateFile = Record<string, { lastNudgeAt?: number; token?: string; noWindowUntil?: number }>;

function log(msg: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({ at: new Date().toISOString(), msg, ...extra });
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, line + '\n');
}

function loadState(): StateFile {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE, 'utf8')) as Record<string, unknown>;
    if (raw.lastNudgeAt != null && raw.mlc == null && raw.cr == null) {
      return { mlc: { lastNudgeAt: raw.lastNudgeAt as number, token: raw.token as string | undefined } };
    }
    return raw as StateFile;
  } catch {
    return {};
  }
}

function saveState(st: StateFile) {
  fs.writeFileSync(STATE, JSON.stringify(st, null, 2));
}

async function health(): Promise<boolean> {
  try {
    return (await fetch(`${CR_BASE}/api/health`)).ok;
  } catch {
    return false;
  }
}

async function waitHealth(maxMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await health()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function ensureServer(): void {
  if (process.env.CR_OVERNIGHT_NO_RESTART === '1') return;
  spawn('npm', ['run', 'dev:server'], {
    cwd: REPO,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CR_WATCHDOG: process.env.CR_WATCHDOG ?? '1' },
  }).unref();
  log('server restart attempted');
}

async function serverSession(composerId: string) {
  const r = await fetch(`${CR_BASE}/api/session?composerId=${composerId}`);
  if (!r.ok) throw new Error(`session ${r.status}`);
  return r.json() as Promise<{
    agent: { busy: boolean; phase?: string; dbStatus?: string };
    modal: string;
    queueLength: number;
    windowTitle?: string;
  }>;
}

async function flushServerQueue(composerId: string): Promise<void> {
  const r = await fetch(`${CR_BASE}/api/send/flush?composerId=${encodeURIComponent(composerId)}`, {
    method: 'POST',
  });
  if (!r.ok) return;
  const j = (await r.json()) as { sent?: number; remaining?: number };
  if (j.sent) log('server queue flushed', { composerId, ...j });
}

async function watchdogStats(): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${CR_BASE}/api/watchdog/stats`);
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function tickTarget(target: AgentTarget, usageWindows: Awaited<ReturnType<typeof probeWindowUsage>>) {
  const st = loadState();
  const entry = st[target.id] ?? {};

  let session;
  try {
    session = await serverSession(target.composerId);
  } catch (e) {
    log('session fail', { target: target.id, err: e instanceof Error ? e.message : String(e) });
    return;
  }

  const winUsage = usageWindows.find((w) => w.windowTitle.includes(target.windowHint));
  const usagePct = winUsage?.usagePct ?? null;
  const reconnecting = winUsage?.reconnecting ?? false;

  log('tick', {
    target: target.id,
    busy: session.agent.busy,
    modal: session.modal,
    queue: session.queueLength,
    dbStatus: session.agent.dbStatus,
    usagePct,
    model: winUsage?.model,
    reconnecting,
  });

  if (usagePct != null && usagePct >= USAGE_PAUSE_PCT) {
    log('usage pause', { target: target.id, usagePct });
    return;
  }
  if (target.fastOnly && winUsage && isExpensiveModel(winUsage.model)) {
    log('expensive model', { target: target.id, model: winUsage.model });
    return;
  }
  if (session.modal !== 'none') return;
  if (session.queueLength > 0) {
    await flushServerQueue(target.composerId);
    return;
  }

  const NO_WINDOW_BACKOFF_MS = Number(process.env.CR_NO_WINDOW_BACKOFF_MS) || 10 * 60_000;
  if (!session.windowTitle) {
    log('no window open', { target: target.id, composerId: target.composerId });
    st[target.id] = { ...entry, noWindowUntil: Date.now() + NO_WINDOW_BACKOFF_MS };
    saveState(st);
    return;
  }
  // Clear backoff as soon as window is visible again.
  const noWindowUntil = (entry as { noWindowUntil?: number }).noWindowUntil ?? 0;
  if (noWindowUntil > Date.now()) {
    log('no-window backoff', { target: target.id });
    return;
  }
  if (noWindowUntil) {
    st[target.id] = { ...entry, noWindowUntil: undefined };
    saveState(st);
  }

  const since = Date.now() - (entry.lastNudgeAt ?? 0);
  if (since < COOLDOWN_MS) {
    log('idle cooldown', { target: target.id, sinceMs: since });
    return;
  }

  if (!fs.existsSync(target.agentDir)) {
    log('agent dir missing', { target: target.id, dir: target.agentDir });
    return;
  }

  // Always re-analyze fresh; stale cached report from a previous loop cycle
  // can block guard indefinitely on already-resolved issues.
  const SUPERVISOR_STALE_MS = Number(process.env.CR_SUPERVISOR_STALE_MS) || 2 * COOLDOWN_MS;
  const cached = loadSupervisorReport();
  const cacheAge = cached ? Date.now() - new Date(cached.at).getTime() : Infinity;
  const sup =
    cacheAge < SUPERVISOR_STALE_MS
      ? cached!
      : analyzeSupervisor({ logPath: LOG, targets: resolveTargets() });
  // If window is currently open, skip no_window blocks (historical log entries are stale).
  const blocked = guardBlockedAlerts(sup, target.id).filter(
    (a) => !(a.code === 'no_window' && session.windowTitle)
  );
  if (blocked.length) {
    log('supervisor block', { target: target.id, codes: blocked.map((a) => a.code) });
    return;
  }

  const dbPath = process.env.CURSOR_DB || globalDbPath();
  const reader = CursorDbReader.fromPath(dbPath);
  const store = new ChatStore(reader, dbPath, false);
  const cursor = new CursorModel(store, liveCdp);

  try {
    const chat = store.getChat(target.composerId, true);
    const agentSt = syncAgentState({
      target,
      messages: chat.messages,
      busy: session.agent.busy,
      dbStatus: session.agent.dbStatus,
      reconnecting,
      slowCount: winUsage?.slowCount,
    });
    log('agent state', {
      target: target.id,
      phase: agentSt.phase,
      turnVerify: agentSt.turnVerify,
      promptKey: agentSt.promptKey,
      issue: agentSt.issue,
    });

    if (reconnecting || agentSt.phase === 'stuck_reconnecting' || agentSt.phase === 'stuck_slow') {
      log('stuck skip', { target: target.id, phase: agentSt.phase });
      return;
    }
    if (session.agent.busy) return;

    const reg = await cursor.registerAgentToken({ composerId: target.composerId });

    if (agentSt.phase === 'turn_incomplete') {
      const r = buildGuardRecovery(reg.token, target.id, agentSt.issue ?? 'turn incomplete');
      const sendR = await cursor.send(r.text, { token: reg.token, windowTitle: session.windowTitle });
      st[target.id] = { lastNudgeAt: Date.now(), token: reg.token };
      saveState(st);
      recordGuardNudge(path.join(target.agentDir, 'SESSION.md'), {
        role: 'Meta',
        step: r.step,
        trackFile: 'TRACK_PLAN.md',
        focus: 'stability',
        reason: r.reason,
        refs: [],
      });
      log('incomplete recovery', { target: target.id, pageTitle: sendR.pageTitle });
      return;
    }

    const plan = planGuardNudge({
      composerId: target.composerId,
      agentDir: target.agentDir,
      messages: chat.messages,
      token: reg.token,
      targetId: target.id,
      pendingTexts: cursor
        .listSendQueue()
        .filter((q) => q.composerId === target.composerId)
        .map((q) => q.text),
    });

    if (plan.action === 'skip') {
      log('guard skip', { target: target.id, reason: plan.reason });
      return;
    }

    const text = plan.text;
    const role = plan.role;
    const step = plan.step;

    const r = await cursor.send(text, {
      token: reg.token,
      windowTitle: session.windowTitle,
    });
    recordGuardNudge(path.join(target.agentDir, 'SESSION.md'), {
      role: role as 'Driver' | 'Meta' | 'Planner' | 'Backlog' | 'Critic' | 'Orchestrator' | 'Cleaner',
      step,
      trackFile: parseAgentPrompt(text).trackFile ?? 'TRACK_PLAN.md',
      focus: 'stability',
      reason: plan.action === 'recovery' ? plan.reason : 'guard nudge',
      refs: [],
    });
    st[target.id] = { lastNudgeAt: Date.now(), token: reg.token };
    saveState(st);
    log(plan.action === 'recovery' ? 'recovery sent' : 'sent', {
      target: target.id,
      role,
      step,
      reason: plan.action === 'recovery' ? plan.reason : undefined,
      pageTitle: r.pageTitle,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (isExpectedSendBlock(err)) {
      log('send blocked', { target: target.id, err });
    } else {
      log('send failed', { target: target.id, err });
    }
  } finally {
    reader.close();
  }
}
/** Detect if a terminal agent pane is idle (showing a prompt, not generating). */
function isTmuxPaneIdle(paneOutput: string): boolean {
  const lines = paneOutput.trimEnd().split('\n');
  // Last non-empty line
  const last = lines.reverse().find((l) => l.trim()) ?? '';
  // Claude Code shows "> " or "$ ", opencode shows its own prompt
  return /[>$#]\s*$/.test(last) || last.trim() === '';
}

async function tickTmuxTarget(target: AgentTarget) {
  if (target.transport !== 'tmux' || !target.paneId) return;

  const st = loadState();
  const entry = st[target.id] ?? {};
  const since = Date.now() - (entry.lastNudgeAt ?? 0);
  if (since < COOLDOWN_MS) {
    log('idle cooldown', { target: target.id, sinceMs: since });
    return;
  }
  if (!fs.existsSync(target.agentDir)) {
    log('agent dir missing', { target: target.id, dir: target.agentDir });
    return;
  }

  let paneOutput: string;
  try {
    paneOutput = capturePaneOutput(target.paneId, 50);
  } catch (e) {
    log('tmux capture fail', { target: target.id, pane: target.paneId, err: e instanceof Error ? e.message : String(e) });
    return;
  }

  if (!isTmuxPaneIdle(paneOutput)) {
    log('tmux busy', { target: target.id, pane: target.paneId });
    return;
  }

  const next = pickNextAgentStep(target.agentDir);
  const TMUX_TOKEN = 'tmux';
  const text = buildNudgePrompt(next, TMUX_TOKEN, target.id);

  try {
    sendKeys(target.paneId, text);
    recordGuardNudge(path.join(target.agentDir, 'SESSION.md'), {
      role: next.role as 'Driver' | 'Meta' | 'Planner' | 'Backlog' | 'Critic',
      step: next.step,
      trackFile: next.trackFile ?? 'TRACK_PLAN.md',
      focus: 'stability',
      reason: 'tmux nudge',
      refs: [],
    });
    st[target.id] = { lastNudgeAt: Date.now() };
    saveState(st);
    log('tmux sent', { target: target.id, pane: target.paneId, role: next.role, step: next.step });
  } catch (e) {
    log('tmux send fail', { target: target.id, err: e instanceof Error ? e.message : String(e) });
  }
}

async function tick() {
  if (!(await health())) {
    log('server down');
    ensureServer();
    if (!(await waitHealth())) {
      log('server still down');
      return;
    }
  }

  const usageWindows = await probeWindowUsage(liveCdp);
  const wd = await watchdogStats();
  if (wd?.paused) {
    log('watchdog paused');
    return;
  }
  if (wd?.errors_total) log('watchdog errors', { total: wd.errors_total });

  for (const target of resolveTargets()) {
    if (target.transport === 'tmux') {
      await tickTmuxTarget(target);
    } else {
      await tickTarget(target, usageWindows);
    }
  }
}

tick()
  .then(() => process.exit(0))
  .catch((e) => {
    log('error', { err: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  });
