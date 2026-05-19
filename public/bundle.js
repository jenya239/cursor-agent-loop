"use strict";
(() => {
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

  // src/ui/views/dom.ts
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function shortPath(p) {
    const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }

  // src/ui/views/render-chat.ts
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
  function renderAgentPanelHtml(m) {
    const mismatch = m.mismatch ? ' \xB7 <span class="mismatch">\u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0447\u0430\u0442 \u2260 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 composer</span>' : "";
    const fallback = m.mismatch && m.composerId ? `<div class="switch-fallback">\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0447\u0430\u0442 \u0432 Cursor \u0432\u0440\u0443\u0447\u043D\u0443\u044E \xB7 <button type="button" class="copy-composer-id">\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C id</button></div>` : "";
    const details = m.cdpDetails ? `<div class="agent-cdp-details" title="${esc(m.cdpDetails)}">${esc(m.cdpDetails)}</div>` : "";
    const main = `\u0430\u0433\u0435\u043D\u0442 \xB7 ${esc(m.label)} \xB7 ${esc(m.cdpLine)} \xB7 ${esc(m.dbLine)}${esc(m.windowLine)}${esc(m.cdpMeta)}${esc(m.switchLine)}${mismatch}`;
    return main + fallback + details;
  }
  function applyAgentPanel(el, m) {
    el.dataset.phase = m.phase;
    el.innerHTML = renderAgentPanelHtml(m);
    const btn = el.querySelector(".copy-composer-id");
    if (btn && m.composerId) {
      btn.addEventListener("click", () => {
        void navigator.clipboard.writeText(m.composerId);
      });
    }
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
    let lastSendAt = 0;
    let lastSendText = "";
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
    function render(s) {
      const panel = agentPanelModel(s);
      applyAgentPanel(agentPanelEl, panel);
      agentIndicatorEl.textContent = `AGENT \xB7 ${s.agentBusy ? "\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442" : "\u0436\u0434\u0451\u0442"}`;
      agentIndicatorEl.className = `agent-indicator ${s.agentBusy ? "busy" : "idle"}`;
      agentIndicatorEl.title = agentPanelEl.textContent;
      statusEl.textContent = s.status;
      statusEl.classList.toggle("loading", s.statusLoading);
      const filtered = filterChats(s.chats, s.wsFilter);
      listEl.innerHTML = renderListHtml(filtered, s.activeComposerId);
      listEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          void openChat(el.dataset.id);
        });
      });
      if (cdpWindowEl && s.snapshot) {
        const cur = s.cdpWindowTitle;
        const opts = cdpWindowOptions(s);
        cdpWindowEl.innerHTML = '<option value="">\u043E\u043A\u043D\u043E CDP (\u0430\u0432\u0442\u043E)</option>' + opts.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
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
