import crypto from 'crypto';
import { AgentModel, type AgentState } from '../agent-model';
import { probeComposerAgent, probeComposerAgentForComposer, probeComposerAgentWindow } from '../cdp/composer-agent-probe';
import type { ChatStore } from '../chat-store';
import type { CdpPort } from '../cdp/port';
import { COMPOSER_AGENT_PROBE_ID } from '../cdp/probes/composer-agent.v1';
import { liveCdp } from '../cdp/live-cdp';
import {
  findWindowForComposerId,
  probeActiveComposer,
  workbenchHasComposerMap,
} from '../cdp/active-composer';
import { fixtureActiveIdForWindow, isFixtureCdp } from '../cdp/fixture-cdp';
import { composerIdsMatch, workspaceHintsFromChat } from '../cdp/window-match';
import { isSendStrict } from '../send-strict';
import { isAgentBusySendError, SendQueue, type QueuedSend } from '../send-queue';
import { cdpProbeFrom } from '../cdp/cdp-probe';
import { SendGate } from './send-gate';
import { bindAgentToken } from './token-bind';
import { generateAgentToken, registerTokenPayload } from './agent-token';
import { resolveAgentToken as resolveAgentTokenDb } from './resolve-agent-token';
import { resolveSendTarget } from './resolve-target';
import type { CursorSession, ModalState } from './session';
import type {
  ChatDetailView,
  ComposerSwitchResult,
  ComposerUiState,
  CursorSnapshot,
  CursorWindow,
} from './types';

const SWITCH_CACHE_MS = 4000;

export class CursorModel {
  private readonly agent: AgentModel;
  private readonly sendQueue: SendQueue;
  private readonly sendGate = new SendGate();
  private draining = false;
  private switchCache: {
    composerId: string;
    at: number;
    result: ComposerSwitchResult;
  } | null = null;

  constructor(
    private readonly store: ChatStore,
    private readonly cdp: CdpPort = liveCdp,
    sendQueue?: SendQueue
  ) {
    this.sendQueue = sendQueue ?? new SendQueue();
    this.agent = new AgentModel(store.reader, cdpProbeFrom(cdp, (id) => {
      const summary = store.getChats().chats.find((c) => c.composerId === id);
      return workspaceHintsFromChat(summary);
    }));
  }

  private hintsFor(composerId: string): string[] | undefined {
    const summary = this.store.getChats().chats.find((c) => c.composerId === composerId);
    return workspaceHintsFromChat(summary);
  }

  private modalState(): ModalState {
    if (isFixtureCdp(this.cdp) && this.cdp.isModalOpen()) return 'pretty_dialog';
    return 'none';
  }

  async session(composerId: string, opts?: { token?: string }): Promise<CursorSession> {
    const hints = this.hintsFor(composerId);
    const open = await findWindowForComposerId(this.cdp, composerId, hints);
    const agent = await this.agent.forComposer(composerId, {
      windowTitle: open?.windowTitle,
      workspaceHints: hints,
    });
    return {
      token: opts?.token,
      composerId,
      windowTitle: open?.windowTitle,
      workspaceHints: hints,
      agent,
      queueLength: this.sendQueue.list().filter((q) => q.composerId === composerId).length,
      modal: this.modalState(),
      at: Date.now(),
    };
  }

  async sessionByToken(token: string): Promise<CursorSession> {
    const target = await resolveSendTarget(this.cdp, { token, db: this.store.reader });
    return this.session(target.composerId, { token });
  }

  private async resolveSwitch(composerId: string): Promise<ComposerSwitchResult | null> {
    if (!(await this.cdp.isAvailable())) return null;
    const hit = this.switchCache;
    if (hit && hit.composerId === composerId && Date.now() - hit.at < SWITCH_CACHE_MS) {
      return hit.result;
    }
    const data = this.store.reader.getComposerData(composerId);
    const summary = this.store.getChats().chats.find((c) => c.composerId === composerId);
    const raw = await this.cdp.switchComposer(composerId, {
      chatName: data?.name ?? summary?.name,
      workspaceHints: workspaceHintsFromChat(summary),
    });
    let result: ComposerSwitchResult = {
      ok: raw.ok,
      reason: raw.reason,
      switchTarget: raw.switchTarget,
    };
    result = (await this.assertSwitchMatches(composerId, result)) ?? result;
    this.switchCache = { composerId, at: Date.now(), result };
    return result;
  }

  private async assertSwitchMatches(
    composerId: string,
    sw: ComposerSwitchResult | null
  ): Promise<ComposerSwitchResult | null> {
    if (!sw?.ok || !sw.switchTarget) return sw;
    if (isFixtureCdp(this.cdp)) {
      if (!fixtureActiveIdForWindow(sw.switchTarget, composerId)) {
        return { ok: false, reason: 'switch-mismatch', switchTarget: sw.switchTarget };
      }
      return sw;
    }
    const active = await probeActiveComposer(this.cdp, { windowTitle: sw.switchTarget });
    if (!active || !composerIdsMatch(active.composerId, composerId)) {
      return {
        ok: false,
        reason: 'switch-mismatch',
        switchTarget: sw.switchTarget,
      };
    }
    return sw;
  }

  async snapshot(
    composerId?: string,
    opts?: { includeChats?: boolean }
  ): Promise<CursorSnapshot> {
    const cdpOk = await this.cdp.isAvailable();
    let windows: CursorWindow[] = [];
    let composerByWindow: ComposerUiState[] = [];
    if (cdpOk) {
      try {
        const targets = await this.cdp.listTargets();
        const probes = await this.cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
        const hasBar = await workbenchHasComposerMap(this.cdp, targets);
        windows = targets
          .filter(
            (t) =>
              (t.type === 'page' && (t.url || '').includes('workbench.html')) ||
              t.type === 'webview'
          )
          .map((t) => ({
            id: t.id,
            title: t.title,
            type: t.type,
            url: t.url,
            hasComposer: hasBar.get(t.id) ?? probes.some((p) => p.title === t.title),
          }));
        composerByWindow = probes.map((p) => ({ windowTitle: p.title, probe: p }));
      } catch {
        /* leave empty */
      }
    }
    const agent = composerId
      ? await this.agent.forComposer(composerId, { workspaceHints: this.hintsFor(composerId) })
      : await this.agent.forCdp();
    const sw = composerId && cdpOk ? await this.resolveSwitch(composerId) : null;
    const snap: CursorSnapshot = {
      at: Date.now(),
      cdp: { ok: cdpOk },
      windows,
      composerByWindow,
      agent,
      switch: sw,
    };
    if (opts?.includeChats) {
      snap.chats = this.store.getChats().chats;
    }
    return snap;
  }

  async chat(composerId: string, fresh = false): Promise<ChatDetailView | null> {
    if (!this.store.reader.getComposerData(composerId)) return null;
    const { summary, messages } = this.store.getChat(composerId, fresh);
    const agent = await this.agent.forComposer(composerId, {
      workspaceHints: this.hintsFor(composerId),
    });
    return {
      summary: summary ?? { composerId, name: 'Untitled' },
      composerId,
      messages,
      agent,
    };
  }

  agentState(composerId?: string, windowTitle?: string): Promise<AgentState> {
    return composerId
      ? this.agent.forComposer(composerId, {
          windowTitle,
          workspaceHints: this.hintsFor(composerId),
        })
      : this.agent.forCdp();
  }

  async registerAgentToken(opts?: { composerId?: string }) {
    const token = generateAgentToken();
    const composerId = opts?.composerId?.trim() || process.env.CR_AGENT_COMPOSER_ID?.trim();
    if (composerId) bindAgentToken(token, composerId);
    return { ...registerTokenPayload(token), composerId: composerId ?? undefined };
  }

  async resolveAgentToken(token: string, composerId?: string) {
    return resolveAgentTokenDb(this.store.reader, token, composerId);
  }

  async getChatByToken(token: string, fresh = false): Promise<ChatDetailView | null> {
    const hit = await resolveSendTarget(this.cdp, { token, db: this.store.reader });
    return this.chat(hit.composerId, fresh);
  }

  async snapshotByToken(
    token: string,
    opts?: { includeChats?: boolean }
  ): Promise<CursorSnapshot> {
    const hit = await resolveSendTarget(this.cdp, { token, db: this.store.reader });
    return this.snapshot(hit.composerId, opts);
  }

  async send(
    text: string,
    opts: { token: string; windowTitle?: string; composerId?: string }
  ): Promise<{ ok: true; text: string; pageTitle: string; composerId?: string; target?: string }> {
    const target = await resolveSendTarget(this.cdp, {
      token: opts.token,
      composerId: opts.composerId,
      db: this.store.reader,
    });
    const summary = this.store.getChats().chats.find((c) => c.composerId === target.composerId);
    const hints = workspaceHintsFromChat(summary);
    const open = await findWindowForComposerId(this.cdp, target.composerId, hints);
    let windowTitle = open?.windowTitle ?? opts.windowTitle;
    if (!open) {
      const sw = await this.resolveSwitch(target.composerId);
      if (sw && !sw.ok) {
        const msg =
          sw.reason === 'switch-mismatch'
            ? `switch mismatch: open chat ${target.composerId} in workspace window (bar shows another composer)`
            : `switch failed: ${sw.reason}`;
        if (isSendStrict() || sw.reason === 'switch-mismatch' || sw.reason === 'workspace-window-not-found') {
          throw new Error(msg);
        }
      }
      windowTitle = sw?.switchTarget ?? windowTitle;
    }
    const r = await this.cdp.sendMessage(text, { windowTitle });
    return {
      ok: true,
      text: r.text,
      pageTitle: r.pageTitle,
      composerId: target.composerId,
      target: target.resolved,
    };
  }

  async enqueueSend(
    text: string,
    opts: { token: string; windowTitle?: string; composerId?: string }
  ): Promise<
    QueuedSend & {
      position: number;
      native?: boolean;
      deferred?: boolean;
      pageTitle?: string;
      target?: string;
    }
  > {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('empty message');
    const target = await resolveSendTarget(this.cdp, {
      token: opts.token,
      composerId: opts.composerId,
      db: this.store.reader,
    });
    const summary = this.store.getChats().chats.find((c) => c.composerId === target.composerId);
    const hints = workspaceHintsFromChat(summary);
    let windowTitle = opts.windowTitle;
    const open = await findWindowForComposerId(this.cdp, target.composerId, hints);
    if (open) {
      windowTitle = open.windowTitle;
    } else {
      const sw = await this.resolveSwitch(target.composerId);
      if (sw && !sw.ok) {
        throw new Error(
          sw.reason === 'switch-mismatch'
            ? `switch mismatch: open chat ${target.composerId} in workspace window (bar shows another composer)`
            : `switch failed: ${sw.reason}`
        );
      }
      if (sw?.switchTarget) windowTitle = sw.switchTarget;
    }
    if (!(await this.canSendNow(target.composerId, windowTitle))) {
      const item = this.sendQueue.enqueue(trimmed, {
        token: opts.token,
        composerId: target.composerId,
        windowTitle,
      });
      return {
        ...item,
        position: this.sendQueue.length,
        native: false,
        deferred: true,
        target: target.resolved,
      };
    }
    const item = this.sendQueue.enqueue(trimmed, {
      token: opts.token,
      composerId: target.composerId,
      windowTitle,
    });
    return {
      ...item,
      position: this.sendQueue.length,
      native: false,
      deferred: true,
      target: target.resolved,
    };
  }

  listSendQueue(): QueuedSend[] {
    return this.sendQueue.list();
  }

  private async canSendNow(composerId?: string, windowTitle?: string): Promise<boolean> {
    if (!(await this.cdp.isAvailable())) return false;
    const { dbBusy, dbStatus } = composerId
      ? this.agent.dbState(composerId)
      : { dbBusy: false, dbStatus: undefined };
    const cdp = windowTitle
      ? await probeComposerAgentWindow(this.cdp, windowTitle)
      : composerId
        ? await probeComposerAgentForComposer(this.cdp, composerId, {
            workspaceHints: this.hintsFor(composerId),
          })
        : await probeComposerAgent(this.cdp);
    const cdpBusy = cdp.cdpOk && cdp.busy;
    const st: AgentState = {
      phase: cdp.cdpOk ? (dbBusy || cdpBusy ? 'busy' : 'idle') : dbBusy ? 'busy' : 'unknown',
      busy: dbBusy || cdpBusy,
      dbBusy,
      cdpBusy,
      cdpOk: cdp.cdpOk,
      cdpReason: cdp.reason,
      cdpWindowTitle: cdp.windowTitle,
      dbStatus,
      composerId,
      at: Date.now(),
    };
    return this.sendGate.canSend(st, composerId);
  }

  async drainSendQueue(): Promise<{
    sent: number;
    remaining: number;
    lastPageTitle?: string;
    blocked?: string;
  }> {
    if (this.draining) {
      return { sent: 0, remaining: this.sendQueue.length, blocked: 'drain-in-progress' };
    }
    this.draining = true;
    try {
      let sent = 0;
      let lastPageTitle: string | undefined;
      let blocked: string | undefined;
      while (this.sendQueue.peek()) {
        const item = this.sendQueue.peek()!;
        if (!(await this.canSendNow(item.composerId, item.windowTitle))) {
          blocked = 'canSendNow=false (busy/settle/cdp)';
          break;
        }
        this.sendQueue.shift();
        try {
          const r = await this.send(item.text, {
            token: item.token!,
            windowTitle: item.windowTitle,
            composerId: item.composerId,
          });
          lastPageTitle = r.pageTitle;
          sent++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.sendQueue.unshift(item);
          if (process.env.CR_QUEUE_DEBUG === '1') {
            process.stderr.write(`[cr-queue] send failed, re-queued: ${msg}\n`);
          }
          if (isAgentBusySendError(msg)) break;
          blocked = msg;
          break;
        }
      }
      return { sent, remaining: this.sendQueue.length, lastPageTitle, blocked };
    } finally {
      this.draining = false;
    }
  }
}
