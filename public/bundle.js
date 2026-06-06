"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/ui/views/dom.ts
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function shortPath(p) {
    const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }
  var init_dom = __esm({
    "src/ui/views/dom.ts"() {
      "use strict";
    }
  });

  // src/ui/views/render-progress.ts
  var render_progress_exports = {};
  __export(render_progress_exports, {
    renderProgressHtml: () => renderProgressHtml
  });
  function ago(ms) {
    if (ms == null) return "?";
    const s = Math.floor(ms / 1e3);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  }
  function esc2(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fmtMsg(e) {
    const msg = String(e.msg ?? "");
    const parts = [msg];
    if (e.role) parts.push(String(e.role));
    if (e.step) parts.push(`step=${e.step}`);
    if (e.phase) parts.push(`phase=${e.phase}`);
    if (e.reason) parts.push(`(${e.reason})`);
    if (e.err) parts.push(`err: ${String(e.err).slice(0, 80)}`);
    if (e.codes) parts.push(String(e.codes));
    return esc2(parts.join(" "));
  }
  function msgClass(msg) {
    if (/error|fail|blocked|stuck/.test(msg)) return "pr-err";
    if (/sent|recovery/.test(msg)) return "pr-ok";
    if (/skip|cooldown|backoff/.test(msg)) return "pr-dim";
    return "";
  }
  function roleCls(role) {
    if (!role) return "";
    const r = role.toLowerCase();
    if (r === "driver") return "pr-role-driver";
    if (r === "critic") return "pr-role-critic";
    if (r === "planner") return "pr-role-planner";
    if (r === "meta") return "pr-role-meta";
    if (r === "cleaner" || r === "backlog") return "pr-role-util";
    return "pr-role-util";
  }
  function renderSessionTable(turns) {
    if (!turns.length) return '<p class="pr-dim">\u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 SESSION.md</p>';
    const rows = turns.map((t) => {
      const rc = roleCls(t.role);
      const gate = t.gate.replace(/build_tests\s*/i, "").replace(/;\s*build\.sh OK/i, "").trim();
      const timeStr = t.date.length > 10 ? t.date.slice(0, 16) : t.date;
      return `<tr>
      <td class="pr-td-time">${esc2(timeStr)}</td>
      <td><span class="pr-role ${rc}">${esc2(t.role || "?")}</span></td>
      <td class="pr-td-step">${esc2(t.step)}</td>
      <td class="pr-td-done">${esc2(t.done)}</td>
      <td class="pr-td-gate">${esc2(gate)}</td>
    </tr>`;
    }).join("");
    return `<table class="pr-table">
    <thead><tr><th>\u0412\u0440\u0435\u043C\u044F</th><th>\u0420\u043E\u043B\u044C</th><th>\u0428\u0430\u0433</th><th>\u0421\u0434\u0435\u043B\u0430\u043D\u043E</th><th>Gate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  }
  function renderMeetingsTable(meetings) {
    if (!meetings.length) return '<p class="pr-dim">\u043D\u0435\u0442 meeting rooms</p>';
    const rows = meetings.map((meeting) => {
      const status = meeting.endedAt ? esc2(meeting.endedAt) : '<span class="pr-ok">open</span>';
      return `<tr>
      <td class="pr-td-time">${esc2(meeting.startedAt)}</td>
      <td class="pr-td-done">${esc2(meeting.topic)}</td>
      <td><code class="pr-hash">${esc2(meeting.slug)}</code></td>
      <td class="pr-td-gate">${status}</td>
    </tr>`;
    }).join("");
    return `<table class="pr-table">
    <thead><tr><th>\u0414\u0430\u0442\u0430</th><th>\u0422\u0435\u043C\u0430</th><th>Slug</th><th>\u0421\u0442\u0430\u0442\u0443\u0441</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  }
  function renderCommits(commits) {
    if (!commits.length) return '<p class="pr-dim">\u043D\u0435\u0442 \u043A\u043E\u043C\u043C\u0438\u0442\u043E\u0432</p>';
    const rows = commits.map((c) => `<tr>
    <td class="pr-td-time">${esc2(c.time.slice(5, 16))}</td>
    <td><code class="pr-hash">${esc2(c.hash)}</code></td>
    <td class="pr-td-done">${esc2(c.msg)}</td>
  </tr>`).join("");
    return `<table class="pr-table">
    <thead><tr><th>\u0412\u0440\u0435\u043C\u044F</th><th>Hash</th><th>\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  }
  function renderProgressHtml(report) {
    const loopBadge = report.loopRunning ? '<span class="pr-badge pr-badge-ok">loop running</span>' : '<span class="pr-badge pr-badge-err">loop STOPPED</span>';
    const tickInfo = report.lastTickAt ? `last tick <b>${ago(report.lastTickAgoMs)}</b>` : "no ticks recorded";
    const st = report.agentState;
    let stateHtml = '<p class="pr-dim">no agent state</p>';
    if (st) {
      const phaseCls = /running/.test(st.phase) ? "pr-ok" : /stuck|incomplete/.test(st.phase) ? "pr-err" : "";
      stateHtml = `
      <div class="pr-state">
        <span class="${phaseCls}"><b>${esc2(st.phase)}</b></span>
        ${st.promptKey ? `&rarr; <b>${esc2(st.promptKey)}</b>` : ""}
        ${st.turnVerify ? `&middot; verify:${esc2(st.turnVerify)}` : ""}
        ${st.issue ? `<span class="pr-err"> &#9888; ${esc2(st.issue)}</span>` : ""}
      </div>`;
    }
    const primaryTrack = report.tracks.find((t) => t.isPrimary && !t.closed);
    const queuedTracks = report.tracks.filter((t) => t.inProgress && !t.closed && !t.isPrimary);
    const closedCount = report.tracks.filter((t) => t.closed).length;
    let trackHtml = "";
    if (primaryTrack) {
      const pct = primaryTrack.total ? Math.round(primaryTrack.done / primaryTrack.total * 100) : 0;
      const bar = `<div class="pr-bar"><div class="pr-bar-fill" style="width:${pct}%"></div></div>`;
      trackHtml += `<div class="pr-track pr-track-primary"><b>${esc2(primaryTrack.file.replace("TRACK_", "").replace(".md", ""))}</b> ${bar} ${primaryTrack.done}/${primaryTrack.total} steps &middot; pending: [${primaryTrack.pendingSteps.join(",")}]</div>`;
    }
    if (queuedTracks.length) {
      const names = queuedTracks.map((t) => t.file.replace("TRACK_", "").replace(".md", "")).join(", ");
      trackHtml += `<p class="pr-dim">queued: ${esc2(names)}</p>`;
    }
    const upcomingTracks = report.tracks.filter((t) => !t.closed && !t.inProgress).sort((a, b) => a.file.localeCompare(b.file));
    if (upcomingTracks.length) {
      const rows = upcomingTracks.map((t) => {
        const name = t.file.replace("TRACK_", "").replace(".md", "");
        return `<span class="pr-upcoming-name">${esc2(name)}</span>`;
      }).join(" \xB7 ");
      trackHtml += `<p class="pr-dim pr-upcoming">next: ${rows}</p>`;
    }
    if (report.plannedItems?.length) {
      const rows = report.plannedItems.map(
        (item) => `<div class="pr-planned-row">${esc2(item)}</div>`
      ).join("");
      trackHtml += `<details class="pr-planned"><summary class="pr-dim">plan phases</summary>${rows}</details>`;
    }
    if (!trackHtml) trackHtml = '<p class="pr-dim">no active tracks</p>';
    const recentClosed = report.tracks.filter((t) => t.closed).sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "")).slice(0, 5);
    if (recentClosed.length) {
      const rows = recentClosed.map((t) => {
        const name = t.file.replace("TRACK_", "").replace(".md", "");
        const when = t.closedAt ? `<span class="pr-td-time">${esc2(t.closedAt)}</span>` : "";
        return `<div class="pr-closed-row">${when} <span class="pr-closed-name">${esc2(name)}</span> <span class="pr-dim">${t.done}/${t.total}</span></div>`;
      }).join("");
      trackHtml += `<div class="pr-closed-list">${rows}</div>`;
    }
    trackHtml += `<p class="pr-dim">${closedCount} tracks closed total</p>`;
    const actHtml = report.recentActivity.length ? report.recentActivity.map((e) => {
      const t = String(e.at ?? "").replace("T", " ").replace(/\.\d+Z$/, "");
      const cls = msgClass(String(e.msg ?? ""));
      return `<div class="pr-log-row ${cls}"><span class="pr-log-time">${esc2(t)}</span> ${fmtMsg(e)}</div>`;
    }).join("") : '<p class="pr-dim">no recent activity</p>';
    const errHtml = report.errors.length ? report.errors.map((e) => {
      const t = String(e.at ?? "").replace("T", " ").replace(/\.\d+Z$/, "");
      return `<div class="pr-log-row pr-err"><span class="pr-log-time">${esc2(t)}</span> ${fmtMsg(e)}</div>`;
    }).join("") : '<p class="pr-dim pr-ok-text">no errors in last 2h</p>';
    return `
<div class="pr-wrap">
  <div class="pr-header">
    ${loopBadge}
    <span class="pr-dim">${tickInfo}</span>
  </div>

  <h3 class="pr-section">Agent state</h3>
  ${stateHtml}

  <h3 class="pr-section">Active track</h3>
  ${trackHtml}

  <h3 class="pr-section">\u0425\u043E\u0434\u044B \u0430\u0433\u0435\u043D\u0442\u0430</h3>
  ${renderSessionTable(report.sessionTurns)}

  <h3 class="pr-section">Meeting rooms</h3>
  ${renderMeetingsTable(report.meetings)}

  <h3 class="pr-section">\u041A\u043E\u043C\u043C\u0438\u0442\u044B</h3>
  ${renderCommits(report.recentCommits)}

  <h3 class="pr-section">Recent activity (log)</h3>
  <div class="pr-log">${actHtml}</div>

  <h3 class="pr-section">Errors (2h)</h3>
  <div class="pr-log">${errHtml}</div>
</div>`;
  }
  var init_render_progress = __esm({
    "src/ui/views/render-progress.ts"() {
      "use strict";
    }
  });

  // src/ui/views/render-billing.ts
  function renderBillingHtml(data, error) {
    if (error) {
      return `<p class="billing-error">${esc(error)}</p>`;
    }
    if (!data?.entries.length) {
      return '<p class="hint">\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 cost_entries \u2014 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 cursor_enqueue_send.</p>';
    }
    const rows = data.entries.map(
      (entry) => `<tr>
        <td>${esc(entry.created_at)}</td>
        <td>${esc(entry.event_type)}</td>
        <td>${entry.context_percent != null ? `${entry.context_percent}%` : "\u2014"}</td>
        <td>${esc(entry.model ?? "\u2014")}</td>
        <td>${esc(shortToken(entry.agent_token))}</td>
        <td>${esc(shortComposer(entry.composer_id))}</td>
      </tr>`
    ).join("");
    return `<table class="billing-table">
    <thead><tr>
      <th>time</th><th>event</th><th>context</th><th>model</th><th>token</th><th>composer</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  }
  function shortToken(token) {
    if (!token) return "\u2014";
    return token.length > 16 ? `${token.slice(0, 14)}\u2026` : token;
  }
  function shortComposer(composerId) {
    if (!composerId) return "\u2014";
    return composerId.length > 12 ? `${composerId.slice(0, 8)}\u2026` : composerId;
  }
  var init_render_billing = __esm({
    "src/ui/views/render-billing.ts"() {
      "use strict";
      init_dom();
    }
  });

  // src/ui/billing-tab.ts
  var billing_tab_exports = {};
  __export(billing_tab_exports, {
    loadBillingPanelHtml: () => loadBillingPanelHtml
  });
  async function loadBillingPanelHtml(fetchFn = fetch) {
    try {
      const response = await fetchFn("/api/billing");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return renderBillingHtml(null, body.error || response.statusText);
      }
      return renderBillingHtml(await response.json());
    } catch (error) {
      return renderBillingHtml(
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  var init_billing_tab = __esm({
    "src/ui/billing-tab.ts"() {
      "use strict";
      init_render_billing();
    }
  });

  // src/ui/api/live-api.ts
  async function json(res) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    return res.json();
  }
  var LiveApi = class {
    async snapshot(composerId) {
      const params = new URLSearchParams();
      if (composerId) params.set("composerId", composerId);
      const q = params.toString();
      return json(await fetch(`/api/cursor/snapshot${q ? `?${q}` : ""}`));
    }
    async chat(composerId, fresh = false) {
      const q = fresh ? "?fresh=1" : "";
      return json(await fetch(`/api/chats/${encodeURIComponent(composerId)}${q}`));
    }
    async send(text, composerId, windowTitle) {
      return json(
        await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, composerId, windowTitle })
        })
      );
    }
    async refreshDb() {
      return json(await fetch("/api/refresh", { method: "POST" }));
    }
    async listChats() {
      return json(await fetch("/api/chats"));
    }
    async status() {
      return json(await fetch("/api/status"));
    }
  };

  // src/ui/embed.ts
  function isEmbeddedInCursor() {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  // src/agent-session.ts
  function applyAgentPoll(prevBusy, activeComposerId, chat) {
    if (!activeComposerId || chat.composerId !== activeComposerId) {
      return { busy: prevBusy, event: null, detail: null };
    }
    const busy = !!chat.agentBusy;
    const detail = {
      composerId: activeComposerId,
      agentStatus: chat.agentStatus,
      messageCount: chat.messageCount
    };
    if (busy === prevBusy) {
      return { busy, event: null, detail };
    }
    return { busy, event: busy ? "agent:busy" : "agent:idle", detail };
  }

  // src/ui/poll/refresh-policy.ts
  function shouldRefreshChat(ctx) {
    if (ctx.force || ctx.afterSend) return true;
    const prev = ctx.prevAgent;
    const next = ctx.snap.agent;
    if (prev?.busy && !next.busy) return true;
    return false;
  }
  function agentTransition(prev, next) {
    if (!prev) return null;
    if (!prev.busy && next.busy) return "agent:busy";
    if (prev.busy && !next.busy) return "agent:idle";
    return null;
  }

  // src/ui/views/chat-sig.ts
  function chatSignature(data) {
    const busy = data.agentBusy || data.agent?.busy ? "b" : "i";
    const msgs = data.messages || [];
    if (!msgs.length) return `${busy}:0`;
    const last = msgs[msgs.length - 1];
    return `${busy}:${msgs.length}:${last.bubbleId}:${(last.text || "").length}`;
  }

  // src/ui/poll/snapshot-stream.ts
  function openSnapshotStream(composerId, onSnap, onFallback) {
    if (typeof EventSource === "undefined") {
      onFallback();
      return { close() {
      } };
    }
    const params = new URLSearchParams();
    if (composerId) params.set("composerId", composerId);
    const es = new EventSource(`/api/cursor/events?${params}`);
    let prevBusy = null;
    es.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data);
        const busy = snap.agent.busy;
        const agentEvent = prevBusy === null ? null : busy !== prevBusy ? busy ? "agent:busy" : "agent:idle" : null;
        prevBusy = busy;
        onSnap(snap, agentEvent);
      } catch {
      }
    };
    es.onerror = () => {
      es.close();
      onFallback();
    };
    return {
      close() {
        es.close();
      }
    };
  }

  // src/ui/poll/poll-scheduler.ts
  var POLL_MS = 800;
  var defaultClock = {
    setInterval(fn, ms) {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    }
  };
  var PollScheduler = class {
    constructor(api, store, clock = defaultClock) {
      this.api = api;
      this.store = store;
      this.clock = clock;
    }
    stop;
    stream;
    prevAgentBusy = false;
    usePoll = false;
    start() {
      this.halt();
      if (!this.usePoll && typeof EventSource !== "undefined") {
        const id = this.store.get().activeComposerId;
        this.stream = openSnapshotStream(
          id,
          (snap, ev) => this.applySnapshot(snap, ev),
          () => {
            this.usePoll = true;
            this.startPoll();
          }
        );
        return;
      }
      this.startPoll();
    }
    startPoll() {
      void this.tick();
      this.stop = this.clock.setInterval(() => void this.tick(), POLL_MS);
    }
    halt() {
      this.stop?.();
      this.stop = void 0;
      this.stream?.close();
      this.stream = void 0;
    }
    applySnapshot(snap, ev) {
      const state = this.store.get();
      const id = state.activeComposerId;
      this.store.dispatch({ type: "SNAPSHOT", snap, agentEvent: ev });
      if (id && ev) {
        applyAgentPoll(this.prevAgentBusy, id, {
          composerId: id,
          agentBusy: snap.agent.busy,
          agentStatus: snap.agent.dbStatus,
          messageCount: state.messages.length
        });
      }
      this.prevAgentBusy = snap.agent.busy;
      if (id && shouldRefreshChat({ prevAgent: state.agent, snap, force: false, afterSend: false })) {
        void this.refreshChat(id, true, true);
      }
    }
    async tick() {
      const state = this.store.get();
      const id = state.activeComposerId;
      const prevAgent = state.agent;
      try {
        const snap = await this.api.snapshot(id ?? void 0);
        const ev = prevAgent ? agentTransition(prevAgent, snap.agent) : null;
        this.applySnapshot(snap, ev);
      } catch {
      }
    }
    async refreshChat(id, fresh, force = false) {
      try {
        const chat = await this.api.chat(id, fresh);
        const sig = chatSignature(chat);
        if (!force && sig === this.store.get().chatSig) return chat;
        this.store.dispatch({ type: "CHAT_LOADED", chat, sig });
        return chat;
      } catch {
        return null;
      }
    }
  };

  // src/ui/state/selectors.ts
  function filterChats(chats, wsFilter) {
    if (!wsFilter) return chats;
    return chats.filter(
      (c) => c.workspaceId === wsFilter || c.workspaceLabel === wsFilter || c.workspacePath === wsFilter
    );
  }
  function isComposerMismatch(state) {
    if (!state.activeComposerId || !state.snapshot?.cdp.ok) return false;
    const sw = state.snapshot.switch;
    if (sw?.ok) return false;
    if (sw && !sw.ok) return true;
    const chatName = (state.chatMeta?.name || "").trim();
    const win = (state.agent?.cdpWindowTitle || "").trim();
    if (chatName && win && !win.includes(chatName) && chatName.length > 3) {
      return true;
    }
    return false;
  }
  function formatCdpDetails(state) {
    const rows = state.snapshot?.composerByWindow || [];
    if (!rows.length) return "";
    return rows.map((w) => {
      const p = w.probe;
      const ctrl = (p.controls || []).map((c) => `${c.role}${c.visible ? "" : "?"}`).join(",");
      return `${w.windowTitle}: ${p.busy ? "busy" : "idle"}(${p.reason})${ctrl ? `[${ctrl}]` : ""}`;
    }).join(" | ");
  }
  function agentPanelModel(state) {
    const st = state.agent;
    if (!st) {
      return {
        phase: "unknown",
        label: "\u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445",
        cdpLine: "",
        dbLine: "",
        windowLine: "",
        cdpMeta: "",
        cdpDetails: "",
        switchLine: "",
        mismatch: false,
        composerId: state.activeComposerId
      };
    }
    const label = st.busy ? "\u0420\u0410\u0411\u041E\u0422\u0410\u0415\u0422" : "\u0416\u0414\u0401\u0422";
    const cdpLine = st.cdpOk ? st.cdpBusy ? `Cursor \u0437\u0430\u043D\u044F\u0442 (${st.cdpReason || "?"})` : "Cursor \u0441\u0432\u043E\u0431\u043E\u0434\u0435\u043D" : "CDP \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D";
    const dbLine = st.dbBusy ? `\u0447\u0430\u0442 \u0437\u0430\u043D\u044F\u0442 (${st.dbStatus || "?"})` : "\u0447\u0430\u0442 \u0441\u0432\u043E\u0431\u043E\u0434\u0435\u043D";
    const windowLine = st.cdpWindowTitle ? ` \xB7 ${st.cdpWindowTitle}` : "";
    const n = state.snapshot?.windows?.length;
    const busyN = state.snapshot?.composerByWindow?.filter((w) => w.probe?.busy).length ?? 0;
    const cdpMeta = state.snapshot?.cdp?.ok && n ? ` \xB7 CDP ${n} \u043E\u043A\u043D${busyN ? `, ${busyN} \u0437\u0430\u043D\u044F\u0442\u043E` : ""}` : "";
    const sw = state.snapshot?.switch;
    const switchLine = sw ? ` \xB7 switch: ${sw.ok ? "ok" : "fail"}(${sw.reason})${sw.switchTarget ? ` \u2192 ${sw.switchTarget}` : ""}` : "";
    const cdpDetails = formatCdpDetails(state);
    return {
      phase: st.phase,
      label,
      cdpLine,
      dbLine,
      windowLine,
      cdpMeta,
      cdpDetails,
      switchLine,
      mismatch: isComposerMismatch(state),
      composerId: state.activeComposerId
    };
  }
  function workspaceOptions(chats) {
    const map = /* @__PURE__ */ new Map();
    for (const c of chats) {
      const key = c.workspaceId || c.workspaceLabel || "\u2014";
      if (!map.has(key)) {
        map.set(key, { key, label: c.workspaceLabel || "\u2014", path: c.workspacePath || "" });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }
  function cdpWindowOptions(state) {
    return (state.snapshot?.windows || []).filter((w) => w.hasComposer || w.type === "page").map((w) => w.title);
  }

  // src/ui/agent-bus.ts
  var AgentBusImpl = class {
    subs = /* @__PURE__ */ new Map();
    on(event, fn) {
      let set = this.subs.get(event);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        this.subs.set(event, set);
      }
      set.add(fn);
      return () => set.delete(fn);
    }
    emit(event) {
      for (const fn of this.subs.get(event) ?? []) fn();
    }
  };
  var agentBus = new AgentBusImpl();

  // src/ui/state/store.ts
  var initialUiState = (embedded) => ({
    activeComposerId: null,
    chats: [],
    messages: [],
    chatMeta: null,
    snapshot: null,
    agent: null,
    agentBusy: false,
    chatSig: "",
    sending: false,
    status: "\u2026",
    statusLoading: true,
    wsFilter: "",
    cdpWindowTitle: "",
    listPartial: false,
    listLoading: true,
    embedded,
    lastAgentEvent: null
  });
  function reduceUi(state, action) {
    switch (action.type) {
      case "SNAPSHOT":
        return {
          ...state,
          snapshot: action.snap,
          agent: action.snap.agent,
          agentBusy: action.snap.agent.busy,
          lastAgentEvent: action.agentEvent ?? state.lastAgentEvent
        };
      case "CHAT_LOADED": {
        const c = action.chat;
        return {
          ...state,
          messages: c.messages,
          chatMeta: {
            composerId: c.composerId,
            name: c.name || c.summary?.name || "\u2014",
            workspacePath: c.workspacePath ?? c.summary?.workspacePath,
            workspaceLabel: c.workspaceLabel ?? c.summary?.workspaceLabel,
            unifiedMode: c.unifiedMode ?? c.summary?.unifiedMode
          },
          agent: c.agent,
          agentBusy: !!c.agentBusy || c.agent.busy,
          chatSig: action.sig
        };
      }
      case "SELECT_CHAT":
        return { ...state, activeComposerId: action.composerId, chatSig: "", messages: [] };
      case "SET_CHATS":
        return {
          ...state,
          chats: action.chats,
          listPartial: !!action.partial,
          listLoading: !!action.loading
        };
      case "WS_FILTER":
        return { ...state, wsFilter: action.value };
      case "CDP_WINDOW":
        return { ...state, cdpWindowTitle: action.title };
      case "STATUS":
        return {
          ...state,
          status: action.text,
          statusLoading: action.loading ?? state.statusLoading
        };
      case "SEND_START":
        return { ...state, sending: true };
      case "SEND_END":
        return { ...state, sending: false };
      case "SET_AGENT":
        return {
          ...state,
          agent: action.agent,
          agentBusy: !!action.agent?.busy
        };
      default:
        return state;
    }
  }
  var CrStore = class {
    state;
    subs = /* @__PURE__ */ new Set();
    constructor(embedded) {
      this.state = initialUiState(embedded);
    }
    get() {
      return this.state;
    }
    dispatch(action) {
      this.state = reduceUi(this.state, action);
      if (action.type === "SNAPSHOT" && action.agentEvent) {
        agentBus.emit(action.agentEvent);
      }
      for (const fn of this.subs) fn(this.state);
    }
    subscribe(fn) {
      this.subs.add(fn);
      return () => this.subs.delete(fn);
    }
  };

  // src/ui/app.ts
  init_dom();

  // src/ui/views/render-chat.ts
  init_dom();
  function tag(m) {
    if (m.role === "user") return "u";
    return (m.text || "").startsWith("[") ? "t" : "a";
  }
  function renderChatHtml(data) {
    const ws = data.workspacePath ? `<span class="chat-ws">${esc(shortPath(data.workspacePath))}</span> ` : data.workspaceLabel ? `<span class="chat-ws">${esc(data.workspaceLabel)}</span> ` : "";
    const title = esc(data.name || data.summary?.name || "\u2014");
    const busy = data.agentBusy || data.agent?.busy ? '<span class="agent-busy" title="\u0430\u0433\u0435\u043D\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442">AGENT</span> ' : "";
    const body = (data.messages || []).map(
      (m) => `<article class="msg ${m.role}${(m.text || "").startsWith("[") ? " tool" : ""}"><span class="tag">${tag(m)}</span><pre>${esc(m.text || "")}</pre></article>`
    ).join("");
    return `<div class="chat-hdr">${ws}${title} ${busy}<span class="msg-count">${(data.messages || []).length}</span></div>${body || '<p class="hint">\u043F\u0443\u0441\u0442\u043E</p>'}<div id="chat-end" aria-hidden="true"></div>`;
  }

  // src/ui/views/render-list.ts
  init_dom();
  function renderListHtml(chats, activeId) {
    if (!chats.length) return '<p class="hint">\u0427\u0430\u0442\u043E\u0432 \u043D\u0435\u0442</p>';
    const groups = /* @__PURE__ */ new Map();
    for (const c of chats) {
      const g = c.workspaceLabel || "\u2014";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b, "ru"));
    let html = "";
    for (const label of labels) {
      const items = groups.get(label);
      const sample = items[0];
      const pathHint = sample.workspacePath ? shortPath(sample.workspacePath) : "";
      html += `<div class="ws-hdr" title="${esc(sample.workspacePath || "")}">${esc(label)}${pathHint ? ` <span class="ws-path">${esc(pathHint)}</span>` : ""}</div>`;
      for (const c of items) {
        const mode = (c.unifiedMode || "?").slice(0, 2);
        html += `<a class="item${c.composerId === activeId ? " active" : ""}" href="#" data-id="${c.composerId}" title="${esc(c.name)}">
      <span class="mode">${esc(mode)}</span><span class="name">${esc(c.name)}</span></a>`;
      }
    }
    return html;
  }

  // src/ui/views/render-agent-panel.ts
  init_dom();
  function renderAgentPanelHtml(m) {
    const mismatch = m.mismatch ? ' \xB7 <span class="mismatch">\u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0447\u0430\u0442 \u2260 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 composer</span>' : "";
    const fallback = m.mismatch && m.composerId ? `<div class="switch-fallback">\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0430\u0442 \u0432 Cursor \u0432\u0440\u0443\u0447\u043D\u0443\u044E \xB7 <button type="button" class="copy-composer-id">\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C id</button></div>` : "";
    const details = m.cdpDetails ? `<div class="agent-cdp-details" title="${esc(m.cdpDetails)}">${esc(m.cdpDetails)}</div>` : "";
    const main = `\u0430\u0433\u0435\u043D\u0442 \xB7 ${esc(m.label)} \xB7 ${esc(m.cdpLine)} \xB7 ${esc(m.dbLine)}${esc(m.windowLine)}${esc(m.cdpMeta)}${esc(m.switchLine)}${mismatch}`;
    return main + fallback + details;
  }
  var _lastAgentHtml = "";
  function applyAgentPanel(el, m) {
    el.dataset.phase = m.phase;
    const html = renderAgentPanelHtml(m);
    if (html === _lastAgentHtml) return;
    _lastAgentHtml = html;
    el.innerHTML = html;
    const btn = el.querySelector(".copy-composer-id");
    if (btn && m.composerId) {
      btn.addEventListener("click", () => {
        void navigator.clipboard.writeText(m.composerId);
      });
    }
  }

  // src/ui/views/render-layout-tree.ts
  init_dom();
  function renderNodeHeadHtml(node) {
    const kind = `<span class="lk">${esc(node.kind)}</span>`;
    const state = node.state ? ` <span class="ls">${esc(node.state)}</span>` : "";
    const attrs = node.attrs && Object.keys(node.attrs).length ? ` <span class="la">${esc(
      Object.entries(node.attrs).map(([k, v]) => `${k}=${v}`).join(" ")
    )}</span>` : "";
    return `<span class="ll">${esc(node.label)}</span> ${kind}${state}${attrs}`;
  }
  function renderNode(node, depth) {
    const pad = depth * 12;
    const head = renderNodeHeadHtml(node);
    const lid = ` data-lid="${esc(node.id)}"`;
    if (!node.children?.length) {
      return `<div class="ln"${lid} style="padding-left:${pad}px">${head}</div>`;
    }
    const inner = node.children.map((c) => renderNode(c, depth + 1)).join("");
    return `<details class="ln"${lid} style="padding-left:${pad}px" open><summary>${head}</summary>${inner}</details>`;
  }
  function renderLayoutTreeHtml(snap, err) {
    if (err) {
      return `<p class="err">${esc(err)}</p><p class="hint">npm run dev, CDP on :9222</p>`;
    }
    if (!snap) return '<p class="loading">loading...</p>';
    if (!snap.cdpOk) return '<p class="err">CDP nedostupen</p>';
    if (!snap.windows.length) return '<p class="hint">net okon</p>';
    const summary = `<div class="wd-summary" data-layout-part="summary">okon ${snap.windows.length} &middot; ${new Date(snap.at).toISOString()}</div>`;
    const trees = snap.windows.map((w) => {
      const meta = `<div class="lw-head">${esc(w.title)} &middot; <code>${esc(w.shell)}</code> &middot; ${esc(w.kind)}</div>`;
      return `<section class="lw" data-window-id="${esc(w.targetId)}">${meta}<div class="layout-tree">${renderNode(w.tree, 0)}</div></section>`;
    }).join("");
    return `<div data-layout-root>${summary}${trees}</div>`;
  }

  // src/ui/layout-tab.ts
  async function loadLayoutSnapshot(fetchFn = fetch) {
    const r = await fetchFn("/api/cursor/layout");
    const ct = r.headers.get("content-type") || "";
    if (!r.ok) {
      if (ct.includes("json")) {
        const body = await r.json();
        return { snap: null, err: body.error || r.statusText };
      }
      return { snap: null, err: r.statusText };
    }
    return { snap: await r.json() };
  }

  // src/ui/views/patch-layout-tree.ts
  init_dom();
  function qid(id) {
    return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function collectLayoutOpenState(root) {
    const out = /* @__PURE__ */ new Map();
    for (const el of root.querySelectorAll("details[data-lid]")) {
      const lid = el.dataset.lid;
      if (lid) out.set(lid, el.open);
    }
    return out;
  }
  function defaultOpen(lid, openState) {
    return openState.has(lid) ? openState.get(lid) : true;
  }
  function setHead(el, node) {
    const html = renderNodeHeadHtml(node);
    if (el.tagName === "DETAILS") {
      const summary = el.querySelector(":scope > summary");
      if (summary && summary.innerHTML !== html) summary.innerHTML = html;
      return;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  function patchNode(parent, node, depth, openState) {
    const pad = depth * 12;
    const sel = `:scope > [data-lid="${qid(node.id)}"]`;
    let el = parent.querySelector(sel);
    const hasChildren = !!node.children?.length;
    if (!hasChildren) {
      if (!el || el.tagName !== "DIV") {
        el?.remove();
        el = document.createElement("div");
        el.className = "ln";
        el.dataset.lid = node.id;
        parent.appendChild(el);
      }
      el.style.paddingLeft = `${pad}px`;
      setHead(el, node);
      return el;
    }
    if (!el || el.tagName !== "DETAILS") {
      el?.remove();
      el = document.createElement("details");
      el.className = "ln";
      el.dataset.lid = node.id;
      el.appendChild(document.createElement("summary"));
      parent.appendChild(el);
    }
    el.style.paddingLeft = `${pad}px`;
    setHead(el, node);
    el.open = defaultOpen(node.id, openState);
    const keep = new Set(node.children.map((c) => c.id));
    for (const child of [...el.querySelectorAll(":scope > [data-lid]")]) {
      if (!keep.has(child.dataset.lid)) child.remove();
    }
    for (const child of node.children) {
      el.appendChild(patchNode(el, child, depth + 1, openState));
    }
    return el;
  }
  function patchWindowSection(root, w, openState) {
    const sel = `:scope > section.lw[data-window-id="${qid(w.targetId)}"]`;
    let section = root.querySelector(sel);
    if (!section) {
      section = document.createElement("section");
      section.className = "lw";
      section.dataset.windowId = w.targetId;
      section.innerHTML = `<div class="lw-head"></div><div class="layout-tree"></div>`;
      root.appendChild(section);
    }
    const head = section.querySelector(".lw-head");
    const headHtml = `${esc(w.title)} \uFFFD <code>${esc(w.shell)}</code> \uFFFD ${esc(w.kind)}`;
    if (head.innerHTML !== headHtml) head.innerHTML = headHtml;
    const tree = section.querySelector(".layout-tree");
    const keep = new Set(collectIds(w.tree));
    for (const child of [...tree.querySelectorAll(":scope > [data-lid]")]) {
      if (!keep.has(child.dataset.lid)) child.remove();
    }
    patchNode(tree, w.tree, 0, openState);
  }
  function collectIds(node) {
    const out = [node.id];
    for (const c of node.children || []) out.push(...collectIds(c));
    return out;
  }
  function patchLayoutTree(container, snap, err, openState = /* @__PURE__ */ new Map()) {
    if (err || !snap || !snap.cdpOk || !snap.windows.length) {
      container.innerHTML = renderLayoutTreeHtml(snap, err);
      return;
    }
    let root = container.querySelector("[data-layout-root]");
    if (!root) {
      container.innerHTML = renderLayoutTreeHtml(snap);
      return;
    }
    const summary = root.querySelector('[data-layout-part="summary"]');
    if (summary) {
      summary.innerHTML = `okon ${snap.windows.length} &middot; ${new Date(snap.at).toISOString()}`;
    }
    const keepWindows = new Set(snap.windows.map((w) => w.targetId));
    for (const section of [...root.querySelectorAll(":scope > section.lw[data-window-id]")]) {
      const id = section.dataset.windowId;
      if (id && !keepWindows.has(id)) section.remove();
    }
    for (const w of snap.windows) {
      patchWindowSection(root, w, openState);
    }
  }
  function applyLayoutPanel(container, snap, err) {
    patchLayoutTree(container, snap, err, collectLayoutOpenState(container));
  }

  // src/ui/views/render-watchdog.ts
  init_dom();
  function phaseClass(phase) {
    if (/stuck|incomplete|blocked/.test(phase)) return "wd-bad";
    if (/done|idle/.test(phase)) return "wd-ok";
    if (/pending|running/.test(phase)) return "wd-warn";
    return "";
  }
  function renderAgentSection(agent, agentErr) {
    if (agentErr) {
      return `<p class="hint wd-agent-err">${esc(agentErr)}</p>`;
    }
    if (!agent?.agents?.length) return "";
    const rows = agent.agents.map((a) => {
      const cls = phaseClass(a.phase);
      const issue = a.issue ? esc(a.issue) : "";
      const flags = [a.reconnecting ? "reconnect" : "", a.busy ? "busy" : ""].filter(Boolean).join(" ");
      return `<tr class="${cls}"><td>${esc(a.targetId)}</td><td>${esc(a.phase)}</td><td>${esc(a.turnVerify)}</td><td>${esc(a.promptKey || "")}</td><td>${flags}</td><td>${issue}</td></tr>`;
    }).join("");
    const log = (agent.log || []).slice(-12).reverse().map((t) => {
      const from = t.from ? `${esc(t.from)}\u2192` : "";
      const note = t.note ? ` \xB7 ${esc(t.note)}` : "";
      const key = t.promptKey ? ` \xB7 ${esc(t.promptKey)}` : "";
      return `<li><span class="wd-log-at">${esc(t.at.slice(11, 19))}</span> ${esc(t.targetId)} ${from}${esc(t.to)}${key}${note}</li>`;
    }).join("");
    return `<h3 class="wd-h">orch</h3>
<table class="wd-table wd-agent"><thead><tr><th>target</th><th>phase</th><th>verify</th><th>prompt</th><th>flags</th><th>issue</th></tr></thead><tbody>${rows}</tbody></table>
<h3 class="wd-h">transitions</h3>
<ul class="wd-log">${log || '<li class="hint">\u2014</li>'}</ul>`;
  }
  function renderWatchdogHtml(stats, err, agent, agentErr) {
    const agentBlock = renderAgentSection(agent, agentErr);
    if (err) {
      return `${agentBlock}<p class="err">${esc(err)}</p><p class="hint">npm run dev (watchdog in-process)</p>`;
    }
    if (!stats) return `${agentBlock}<p class="loading">...</p>`;
    const rows = stats.windows.map((w) => {
      const cls = w.reconnecting ? "wd-reconnect" : w.busy && w.slowCount ? "wd-slow" : "";
      const recon = w.reconnecting ? "yes" : "";
      return `<tr class="${cls}"><td>${esc(w.windowTitle)}</td><td>${esc(w.composerId.slice(0, 8))}</td><td>${esc(w.model || "-")}</td><td>${w.busy ? "busy" : "idle"}</td><td>${recon}</td><td>${w.usagePct != null ? w.usagePct + "%" : ""}</td><td>${w.slowCount || ""}</td><td>${w.draftHasToken ? w.draftLen : ""}</td></tr>`;
    }).join("");
    const usageLine = stats.usageMax != null ? ` usageMax ${stats.usageMax}%` : "";
    return `${agentBlock}<div class="wd-summary">
  uptime ${Math.round(stats.uptime_ms / 1e3)}s | polls ${stats.polls_total} | slow ${stats.slow_recoveries_total} | err ${stats.errors_total}${stats.paused ? " | paused" : ""}${usageLine}
  ${stats.last_observe_at ? ` | ${esc(stats.last_observe_at)}` : ""}
</div>
<table class="wd-table"><thead><tr><th>window</th><th>composer</th><th>model</th><th>agent</th><th>recon</th><th>usage</th><th>slow</th><th>draft</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="hint">no windows</td></tr>'}</tbody></table>`;
  }

  // src/ui/watchdog-tab.ts
  async function fetchJson(fetchFn, url) {
    try {
      const r = await fetchFn(url);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }
  async function loadWatchdogPanelHtml(fetchFn = fetch) {
    const [wdRes, agent] = await Promise.all([
      fetchFn("/api/watchdog/stats"),
      fetchJson(fetchFn, "/api/agent/state?refresh=1")
    ]);
    const ct = wdRes.headers.get("content-type") || "";
    if (!wdRes.ok) {
      if (wdRes.status === 404) {
        return renderWatchdogHtml(null, "\u043D\u0435\u0442 /api/watchdog/stats \u2014 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438 npm run dev", agent);
      }
      if (ct.includes("json")) {
        const body = await wdRes.json();
        return renderWatchdogHtml(null, body.error || wdRes.statusText, agent);
      }
      return renderWatchdogHtml(null, wdRes.statusText, agent);
    }
    return renderWatchdogHtml(await wdRes.json(), void 0, agent);
  }

  // src/ui/ui-tabs.ts
  function tabVisibility(tab) {
    return {
      layoutHidden: tab !== "chats",
      watchdogHidden: tab !== "watchdog",
      layoutPanelHidden: tab !== "layout",
      progressHidden: tab !== "progress",
      billingHidden: tab !== "billing"
    };
  }

  // src/ui/app.ts
  var LS_LAST_CHAT = "cr.lastComposerId";
  var SEND_COOLDOWN_MS = 8e3;
  function boot() {
    const embedded = isEmbeddedInCursor();
    const store = new CrStore(embedded);
    const api = new LiveApi();
    const scheduler = new PollScheduler(api, store);
    const listEl = document.getElementById("list");
    const chatEl = document.getElementById("chat");
    const statusEl = document.getElementById("status");
    const refreshBtn = document.getElementById("refresh");
    const wsFilterEl = document.getElementById("ws-filter");
    const cdpWindowEl = document.getElementById("cdp-window");
    const composeInput = document.getElementById("compose-input");
    const composeSend = document.getElementById("compose-send");
    const agentIndicatorEl = document.getElementById("agent-indicator");
    const agentPanelEl = document.getElementById("agent-panel");
    const embedWarn = document.getElementById("embed-warn");
    const dbPathEl = document.getElementById("db-path");
    const layoutEl = document.getElementById("layout");
    const tabChats = document.getElementById("tab-chats");
    const tabWatchdog = document.getElementById("tab-watchdog");
    const tabLayout = document.getElementById("tab-layout");
    const tabProgress = document.getElementById("tab-progress");
    const tabBilling = document.getElementById("tab-billing");
    const watchdogPanel = document.getElementById("watchdog-panel");
    const watchdogBody = document.getElementById("watchdog-body");
    const cursorLayoutPanel = document.getElementById("cursor-layout-panel");
    const cursorLayoutBody = document.getElementById("cursor-layout-body");
    const progressPanel = document.getElementById("progress-panel");
    const progressBody = document.getElementById("progress-body");
    const billingPanel = document.getElementById("billing-panel");
    const billingBody = document.getElementById("billing-body");
    let uiTab = "chats";
    let watchdogTimer = null;
    let layoutTimer = null;
    let progressTimer = null;
    let billingTimer = null;
    let layoutFetch = null;
    let lastSendAt = 0;
    let lastSendText = "";
    async function refreshProgress() {
      try {
        const r = await fetch("/api/progress");
        if (!r.ok) return;
        const data = await r.json();
        const { renderProgressHtml: renderProgressHtml2 } = await Promise.resolve().then(() => (init_render_progress(), render_progress_exports));
        progressBody.innerHTML = renderProgressHtml2(data);
      } catch {
      }
    }
    async function refreshBilling() {
      try {
        const { loadBillingPanelHtml: loadBillingPanelHtml2 } = await Promise.resolve().then(() => (init_billing_tab(), billing_tab_exports));
        billingBody.innerHTML = await loadBillingPanelHtml2();
      } catch {
      }
    }
    function setUiTab(tab) {
      uiTab = tab;
      tabChats.classList.toggle("active", tab === "chats");
      tabWatchdog.classList.toggle("active", tab === "watchdog");
      tabLayout.classList.toggle("active", tab === "layout");
      tabProgress.classList.toggle("active", tab === "progress");
      tabBilling.classList.toggle("active", tab === "billing");
      const vis = tabVisibility(tab);
      layoutEl.hidden = vis.layoutHidden;
      watchdogPanel.hidden = vis.watchdogHidden;
      cursorLayoutPanel.hidden = vis.layoutPanelHidden;
      progressPanel.hidden = vis.progressHidden;
      billingPanel.hidden = vis.billingHidden;
      if (tab === "watchdog") {
        void refreshWatchdog();
        if (!watchdogTimer) watchdogTimer = setInterval(() => void refreshWatchdog(), 15e3);
      } else if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      if (tab === "layout") {
        void refreshLayout();
        if (!layoutTimer) layoutTimer = setInterval(() => void refreshLayout(), 8e3);
      } else if (layoutTimer) {
        clearInterval(layoutTimer);
        layoutTimer = null;
      }
      if (tab === "progress") {
        void refreshProgress();
        if (!progressTimer) progressTimer = setInterval(() => void refreshProgress(), 3e4);
      } else if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (tab === "billing") {
        void refreshBilling();
        if (!billingTimer) billingTimer = setInterval(() => void refreshBilling(), 3e4);
      } else if (billingTimer) {
        clearInterval(billingTimer);
        billingTimer = null;
      }
    }
    async function refreshLayout() {
      if (layoutFetch) return layoutFetch;
      const first = !cursorLayoutBody.querySelector("[data-layout-root]");
      if (first) cursorLayoutBody.innerHTML = '<p class="loading">CDP layout...</p>';
      layoutFetch = (async () => {
        try {
          const { snap, err } = await loadLayoutSnapshot();
          applyLayoutPanel(cursorLayoutBody, snap, err);
        } catch (e) {
          cursorLayoutBody.innerHTML = renderLayoutTreeHtml(
            null,
            e instanceof Error ? e.message : String(e)
          );
        } finally {
          layoutFetch = null;
        }
      })();
      return layoutFetch;
    }
    async function refreshWatchdog() {
      try {
        watchdogBody.innerHTML = await loadWatchdogPanelHtml();
      } catch (e) {
        watchdogBody.innerHTML = renderWatchdogHtml(null, e instanceof Error ? e.message : String(e));
      }
    }
    tabChats.addEventListener("click", () => setUiTab("chats"));
    tabWatchdog.addEventListener("click", () => setUiTab("watchdog"));
    tabLayout.addEventListener("click", () => setUiTab("layout"));
    tabProgress.addEventListener("click", () => setUiTab("progress"));
    tabBilling.addEventListener("click", () => setUiTab("billing"));
    function saveLastChat(id) {
      try {
        localStorage.setItem(LS_LAST_CHAT, id);
      } catch {
      }
    }
    function loadLastChatId() {
      try {
        return localStorage.getItem(LS_LAST_CHAT);
      } catch {
        return null;
      }
    }
    function setComposeEnabled(on) {
      if (embedded) return;
      const s = store.get();
      composeInput.disabled = !on || s.sending;
      composeSend.disabled = !on || s.sending || s.agentBusy;
    }
    function chatAtBottom(threshold = 80) {
      return chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= threshold;
    }
    function scrollChatBottom() {
      const go = () => {
        const end = document.getElementById("chat-end");
        if (end) end.scrollIntoView({ block: "end" });
        else chatEl.scrollTop = chatEl.scrollHeight;
      };
      go();
      requestAnimationFrame(() => {
        go();
        requestAnimationFrame(go);
      });
      setTimeout(go, 50);
    }
    let lastListHtml = "";
    let lastCdpWindowHtml = "";
    function render(s) {
      const panel = agentPanelModel(s);
      applyAgentPanel(agentPanelEl, panel);
      agentIndicatorEl.textContent = `AGENT \xB7 ${s.agentBusy ? "\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442" : "\u0436\u0434\u0451\u0442"}`;
      agentIndicatorEl.className = `agent-indicator ${s.agentBusy ? "busy" : "idle"}`;
      agentIndicatorEl.title = agentPanelEl.textContent;
      statusEl.textContent = s.status;
      statusEl.classList.toggle("loading", s.statusLoading);
      const filtered = filterChats(s.chats, s.wsFilter);
      const newListHtml = renderListHtml(filtered, s.activeComposerId);
      if (newListHtml !== lastListHtml) {
        lastListHtml = newListHtml;
        listEl.innerHTML = newListHtml;
        listEl.querySelectorAll(".item").forEach((el) => {
          el.addEventListener("click", (e) => {
            e.preventDefault();
            void openChat(el.dataset.id);
          });
        });
      }
      if (cdpWindowEl && s.snapshot) {
        const cur = s.cdpWindowTitle;
        const opts = cdpWindowOptions(s);
        const newCdpHtml = '<option value="">\u043E\u043A\u043D\u043E CDP (\u0430\u0432\u0442\u043E)</option>' + opts.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
        if (newCdpHtml !== lastCdpWindowHtml) {
          lastCdpWindowHtml = newCdpHtml;
          cdpWindowEl.innerHTML = newCdpHtml;
        }
        if (cur && [...cdpWindowEl.options].some((o) => o.value === cur)) {
          cdpWindowEl.value = cur;
        }
      }
    }
    store.subscribe(render);
    async function loadList() {
      const [body, st] = await Promise.all([api.listChats(), api.status()]);
      store.dispatch({
        type: "SET_CHATS",
        chats: body.chats,
        partial: body.partial || st.partial,
        loading: body.loading || st.loading
      });
      const s = store.get();
      const n = filterChats(s.chats, s.wsFilter).length;
      const partial = body.partial || st.partial ? " \xB7~" : "";
      const live = s.activeComposerId ? " \xB7 live" : "";
      if (st.loading || body.loading) {
        store.dispatch({ type: "STATUS", text: `${n}\u2026`, loading: true });
        setTimeout(() => void loadList().catch(onListError), 1500);
      } else {
        store.dispatch({ type: "STATUS", text: `${n}${partial}${live}`, loading: false });
        refreshBtn.disabled = false;
        const saved = loadLastChatId();
        if (saved && !s.activeComposerId && s.chats.some((c) => c.composerId === saved)) {
          void openChat(saved);
        }
      }
      fillWorkspaceFilter(body.chats);
    }
    function fillWorkspaceFilter(chats) {
      const cur = wsFilterEl.value;
      const items = workspaceOptions(chats);
      wsFilterEl.innerHTML = '<option value="">\u0432\u0441\u0435</option>' + items.map(
        (w) => `<option value="${esc(w.key)}">${esc(w.label)}${w.path ? " \xB7 " + esc(shortPath(w.path)) : ""}</option>`
      ).join("");
      if (cur && [...wsFilterEl.options].some((o) => o.value === cur)) wsFilterEl.value = cur;
    }
    async function openChat(id) {
      scheduler.halt();
      store.dispatch({ type: "SELECT_CHAT", composerId: id });
      saveLastChat(id);
      chatEl.innerHTML = '<p class="loading">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>';
      setComposeEnabled(true);
      try {
        const chat = await scheduler.refreshChat(id, true, true);
        if (chat) {
          chatEl.innerHTML = renderChatHtml(chat);
          scrollChatBottom();
        }
        scheduler.start();
        composeInput.focus();
      } catch (e) {
        chatEl.innerHTML = `<p class="err">${esc(e instanceof Error ? e.message : String(e))}</p>`;
        setComposeEnabled(false);
      }
    }
    async function submitCompose() {
      if (embedded) return;
      const text = composeInput.value.trim();
      const s = store.get();
      if (!text || !s.activeComposerId || s.sending) return;
      const now = Date.now();
      if (text === lastSendText && now - lastSendAt < SEND_COOLDOWN_MS) return;
      if (now - lastSendAt < 800) return;
      if (s.agentBusy) return;
      if (isComposerMismatch(s)) {
        const ok = window.confirm(
          "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0447\u0430\u0442 \u043C\u043E\u0436\u0435\u0442 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0442\u044C \u0441 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u043C composer \u0432 Cursor. \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E?"
        );
        if (!ok) return;
      }
      const draft = text;
      store.dispatch({ type: "SEND_START" });
      lastSendAt = now;
      lastSendText = draft;
      composeInput.value = "";
      composeInput.blur();
      scheduler.halt();
      const prevStatus = store.get().status;
      store.dispatch({ type: "STATUS", text: "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430\u2026", loading: true });
      try {
        const r = await api.send(draft, s.activeComposerId, s.cdpWindowTitle || void 0);
        const where = r.pageTitle ? ` \u2192 ${r.pageTitle}` : "";
        store.dispatch({ type: "STATUS", text: `\u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E${where}`, loading: false });
        await scheduler.refreshChat(s.activeComposerId, true);
        const chat = store.get();
        if (chat.messages.length) {
          chatEl.innerHTML = renderChatHtml({
            composerId: s.activeComposerId,
            messages: chat.messages,
            agent: chat.agent,
            name: chat.chatMeta?.name,
            workspacePath: chat.chatMeta?.workspacePath,
            workspaceLabel: chat.chatMeta?.workspaceLabel
          });
          scrollChatBottom();
        }
        setTimeout(() => store.dispatch({ type: "STATUS", text: prevStatus, loading: false }), 1500);
      } catch (e) {
        composeInput.value = draft;
        store.dispatch({
          type: "STATUS",
          text: "\u041E\u0448\u0438\u0431\u043A\u0430: " + (e instanceof Error ? e.message : String(e)),
          loading: false
        });
        lastSendText = "";
      } finally {
        store.dispatch({ type: "SEND_END" });
        setComposeEnabled(true);
        scheduler.start();
      }
    }
    function onListError(e) {
      listEl.innerHTML = `<p class="err">${esc(e instanceof Error ? e.message : String(e))}</p>`;
      store.dispatch({ type: "STATUS", text: "\u041E\u0448\u0438\u0431\u043A\u0430", loading: false });
      refreshBtn.disabled = false;
    }
    if (embedded) {
      if (embedWarn) embedWarn.hidden = false;
      composeInput.disabled = true;
      composeSend.disabled = true;
      composeInput.placeholder = "\u0422\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430";
      store.dispatch({ type: "STATUS", text: "\u043E\u0442\u043A\u0440\u043E\u0439 127.0.0.1:3847 \u0432 Firefox/Chrome", loading: false });
    } else {
      composeSend.addEventListener("click", () => void submitCompose());
      composeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          void submitCompose();
        }
      });
    }
    wsFilterEl.addEventListener("change", () => {
      store.dispatch({ type: "WS_FILTER", value: wsFilterEl.value });
      render(store.get());
    });
    if (cdpWindowEl) {
      cdpWindowEl.addEventListener("change", () => {
        store.dispatch({ type: "CDP_WINDOW", title: cdpWindowEl.value });
      });
    }
    refreshBtn.addEventListener("click", () => {
      refreshBtn.disabled = true;
      store.dispatch({ type: "STATUS", text: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u2026", loading: true });
      void (async () => {
        try {
          await api.refreshDb();
          await loadList();
          const id = store.get().activeComposerId;
          if (id) await scheduler.refreshChat(id, true);
        } catch (e) {
          store.dispatch({
            type: "STATUS",
            text: "\u041E\u0448\u0438\u0431\u043A\u0430: " + (e instanceof Error ? e.message : String(e)),
            loading: false
          });
        } finally {
          refreshBtn.disabled = false;
        }
      })();
    });
    window.crAgent = {
      on: (e, fn) => agentBus.on(e, fn)
    };
    void fetch("/api/db").then((r) => r.json()).then((d) => {
      if (dbPathEl && d.path) {
        const short = d.path.split("/").slice(-3).join("/");
        dbPathEl.textContent = short;
        dbPathEl.title = d.path;
      }
    }).catch(() => {
    });
    scheduler.start();
    void loadList().catch(onListError);
  }
  if (typeof document !== "undefined") {
    boot();
  }
})();
