import { LiveApi } from './api/live-api';
import { isEmbeddedInCursor } from './embed';
import { PollScheduler } from './poll/poll-scheduler';
import {
  agentPanelModel,
  cdpWindowOptions,
  filterChats,
  workspaceOptions,
} from './state/selectors';
import { CrStore } from './state/store';
import { esc, shortPath } from './views/dom';
import { renderChatHtml } from './views/render-chat';
import { renderListHtml } from './views/render-list';
import { applyAgentPanel } from './views/render-agent-panel';
import { loadLayoutSnapshot } from './layout-tab';
import { applyLayoutPanel } from './views/patch-layout-tree';
import { renderLayoutTreeHtml } from './views/render-layout-tree';
import { renderWatchdogHtml } from './views/render-watchdog';
import { loadWatchdogPanelHtml } from './watchdog-tab';
import { tabVisibility, type UiTab } from './ui-tabs';
import { isComposerMismatch } from './state/selectors';
import { agentBus } from './agent-bus';

const LS_LAST_CHAT = 'cr.lastComposerId';
const SEND_COOLDOWN_MS = 8000;

export function boot(): void {
  const embedded = isEmbeddedInCursor();
  const store = new CrStore(embedded);
  const api = new LiveApi();
  const scheduler = new PollScheduler(api, store);

  const listEl = document.getElementById('list')!;
  const chatEl = document.getElementById('chat')!;
  const statusEl = document.getElementById('status')!;
  const refreshBtn = document.getElementById('refresh') as HTMLButtonElement;
  const wsFilterEl = document.getElementById('ws-filter') as HTMLSelectElement;
  const cdpWindowEl = document.getElementById('cdp-window') as HTMLSelectElement | null;
  const composeInput = document.getElementById('compose-input') as HTMLTextAreaElement;
  const composeSend = document.getElementById('compose-send') as HTMLButtonElement;
  const agentIndicatorEl = document.getElementById('agent-indicator')!;
  const agentPanelEl = document.getElementById('agent-panel')!;
  const embedWarn = document.getElementById('embed-warn');
  const dbPathEl = document.getElementById('db-path');
  const layoutEl = document.getElementById('layout')!;
  const tabChats = document.getElementById('tab-chats') as HTMLButtonElement;
  const tabWatchdog = document.getElementById('tab-watchdog') as HTMLButtonElement;
  const tabLayout = document.getElementById('tab-layout') as HTMLButtonElement;
  const tabProgress = document.getElementById('tab-progress') as HTMLButtonElement;
  const tabBilling = document.getElementById('tab-billing') as HTMLButtonElement;
  const watchdogPanel = document.getElementById('watchdog-panel')!;
  const watchdogBody = document.getElementById('watchdog-body')!;
  const cursorLayoutPanel = document.getElementById('cursor-layout-panel')!;
  const cursorLayoutBody = document.getElementById('cursor-layout-body')!;
  const progressPanel = document.getElementById('progress-panel')!;
  const progressBody = document.getElementById('progress-body')!;
  const billingPanel = document.getElementById('billing-panel')!;
  const billingBody = document.getElementById('billing-body')!;

  let uiTab: UiTab = 'chats';
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let layoutTimer: ReturnType<typeof setInterval> | null = null;
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let billingTimer: ReturnType<typeof setInterval> | null = null;
  let layoutFetch: Promise<void> | null = null;

  let lastSendAt = 0;
  let lastSendText = '';

  async function refreshProgress() {
    try {
      const r = await fetch('/api/progress');
      if (!r.ok) return;
      const data = await r.json() as unknown;
      const { renderProgressHtml } = await import('./views/render-progress');
      progressBody.innerHTML = renderProgressHtml(data as Parameters<typeof renderProgressHtml>[0]);
    } catch { /* ignore */ }
  }

  async function refreshBilling() {
    try {
      const { loadBillingPanelHtml } = await import('./billing-tab');
      billingBody.innerHTML = await loadBillingPanelHtml();
    } catch { /* ignore */ }
  }

  function setUiTab(tab: UiTab) {
    uiTab = tab;
    tabChats.classList.toggle('active', tab === 'chats');
    tabWatchdog.classList.toggle('active', tab === 'watchdog');
    tabLayout.classList.toggle('active', tab === 'layout');
    tabProgress.classList.toggle('active', tab === 'progress');
    tabBilling.classList.toggle('active', tab === 'billing');
    const vis = tabVisibility(tab);
    layoutEl.hidden = vis.layoutHidden;
    watchdogPanel.hidden = vis.watchdogHidden;
    cursorLayoutPanel.hidden = vis.layoutPanelHidden;
    progressPanel.hidden = vis.progressHidden;
    billingPanel.hidden = vis.billingHidden;
    if (tab === 'watchdog') {
      void refreshWatchdog();
      if (!watchdogTimer) watchdogTimer = setInterval(() => void refreshWatchdog(), 15000);
    } else if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    if (tab === 'layout') {
      void refreshLayout();
      if (!layoutTimer) layoutTimer = setInterval(() => void refreshLayout(), 8000);
    } else if (layoutTimer) {
      clearInterval(layoutTimer);
      layoutTimer = null;
    }
    if (tab === 'progress') {
      void refreshProgress();
      if (!progressTimer) progressTimer = setInterval(() => void refreshProgress(), 30000);
    } else if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    if (tab === 'billing') {
      void refreshBilling();
      if (!billingTimer) billingTimer = setInterval(() => void refreshBilling(), 30000);
    } else if (billingTimer) {
      clearInterval(billingTimer);
      billingTimer = null;
    }
  }

  async function refreshLayout() {
    if (layoutFetch) return layoutFetch;
    const first = !cursorLayoutBody.querySelector('[data-layout-root]');
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

  tabChats.addEventListener('click', () => setUiTab('chats'));
  tabWatchdog.addEventListener('click', () => setUiTab('watchdog'));
  tabLayout.addEventListener('click', () => setUiTab('layout'));
  tabProgress.addEventListener('click', () => setUiTab('progress'));
  tabBilling.addEventListener('click', () => setUiTab('billing'));

  function saveLastChat(id: string) {
    try {
      localStorage.setItem(LS_LAST_CHAT, id);
    } catch {
      /* ignore */
    }
  }

  function loadLastChatId(): string | null {
    try {
      return localStorage.getItem(LS_LAST_CHAT);
    } catch {
      return null;
    }
  }

  function setComposeEnabled(on: boolean) {
    if (embedded) return;
    const s = store.get();
    composeInput.disabled = !on || s.sending;
    composeSend.disabled = !on || s.sending || s.agentBusy;
  }

  function chatAtBottom(threshold = 80): boolean {
    return chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= threshold;
  }

  function scrollChatBottom() {
    const go = () => {
      const end = document.getElementById('chat-end');
      if (end) end.scrollIntoView({ block: 'end' });
      else chatEl.scrollTop = chatEl.scrollHeight;
    };
    go();
    requestAnimationFrame(() => {
      go();
      requestAnimationFrame(go);
    });
    setTimeout(go, 50);
  }

  let lastListHtml = '';
  let lastCdpWindowHtml = '';

  function render(s: ReturnType<CrStore['get']>) {
    const panel = agentPanelModel(s);
    applyAgentPanel(agentPanelEl, panel);
    agentIndicatorEl.textContent = `AGENT · ${s.agentBusy ? 'running' : 'idle'}`;
    agentIndicatorEl.className = `agent-indicator ${s.agentBusy ? 'busy' : 'idle'}`;
    agentIndicatorEl.title = agentPanelEl.textContent;

    statusEl.textContent = s.status;
    statusEl.classList.toggle('loading', s.statusLoading);

    const filtered = filterChats(s.chats, s.wsFilter);
    const newListHtml = renderListHtml(filtered, s.activeComposerId);
    if (newListHtml !== lastListHtml) {
      lastListHtml = newListHtml;
      listEl.innerHTML = newListHtml;
      listEl.querySelectorAll('.item').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          void openChat((el as HTMLElement).dataset.id!);
        });
      });
    }

    if (cdpWindowEl && s.snapshot) {
      const cur = s.cdpWindowTitle;
      const opts = cdpWindowOptions(s);
      const newCdpHtml =
        '<option value="">CDP window (auto)</option>' +
        opts.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
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
      type: 'SET_CHATS',
      chats: body.chats,
      partial: body.partial || st.partial,
      loading: body.loading || st.loading,
    });
    const s = store.get();
    const n = filterChats(s.chats, s.wsFilter).length;
    const partial = body.partial || st.partial ? ' ·~' : '';
    const live = s.activeComposerId ? ' · live' : '';
    if (st.loading || body.loading) {
      store.dispatch({ type: 'STATUS', text: `${n}…`, loading: true });
      setTimeout(() => void loadList().catch(onListError), 1500);
    } else {
      store.dispatch({ type: 'STATUS', text: `${n}${partial}${live}`, loading: false });
      refreshBtn.disabled = false;
      const saved = loadLastChatId();
      if (saved && !s.activeComposerId && s.chats.some((c) => c.composerId === saved)) {
        void openChat(saved);
      }
    }
    fillWorkspaceFilter(body.chats);
  }

  function fillWorkspaceFilter(chats: import('./api/types').ChatSummary[]) {
    const cur = wsFilterEl.value;
    const items = workspaceOptions(chats);
    wsFilterEl.innerHTML =
      '<option value="">all</option>' +
      items
        .map(
          (w) =>
            `<option value="${esc(w.key)}">${esc(w.label)}${w.path ? ' · ' + esc(shortPath(w.path)) : ''}</option>`
        )
        .join('');
    if (cur && [...wsFilterEl.options].some((o) => o.value === cur)) wsFilterEl.value = cur;
  }

  async function openChat(id: string) {
    scheduler.halt();
    store.dispatch({ type: 'SELECT_CHAT', composerId: id });
    saveLastChat(id);
    chatEl.innerHTML = '<p class="loading">Loading…</p>';
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
        'The selected chat may not match the active composer in Cursor. Send anyway?'
      );
      if (!ok) return;
    }

    const draft = text;
    store.dispatch({ type: 'SEND_START' });
    lastSendAt = now;
    lastSendText = draft;
    composeInput.value = '';
    composeInput.blur();
    scheduler.halt();
    const prevStatus = store.get().status;
    store.dispatch({ type: 'STATUS', text: 'Sending…', loading: true });
    try {
      const r = await api.send(draft, s.activeComposerId, s.cdpWindowTitle || undefined);
      const where = r.pageTitle ? ` → ${r.pageTitle}` : '';
      store.dispatch({ type: 'STATUS', text: `sent${where}`, loading: false });
      await scheduler.refreshChat(s.activeComposerId, true);
      const chat = store.get();
      if (chat.messages.length) {
        chatEl.innerHTML = renderChatHtml({
          composerId: s.activeComposerId,
          messages: chat.messages,
          agent: chat.agent!,
          name: chat.chatMeta?.name,
          workspacePath: chat.chatMeta?.workspacePath,
          workspaceLabel: chat.chatMeta?.workspaceLabel,
        });
        scrollChatBottom();
      }
      setTimeout(() => store.dispatch({ type: 'STATUS', text: prevStatus, loading: false }), 1500);
    } catch (e) {
      composeInput.value = draft;
      store.dispatch({
        type: 'STATUS',
        text: 'Error: ' + (e instanceof Error ? e.message : String(e)),
        loading: false,
      });
      lastSendText = '';
    } finally {
      store.dispatch({ type: 'SEND_END' });
      setComposeEnabled(true);
      scheduler.start();
    }
  }

  function onListError(e: unknown) {
    listEl.innerHTML = `<p class="err">${esc(e instanceof Error ? e.message : String(e))}</p>`;
    store.dispatch({ type: 'STATUS', text: 'Error', loading: false });
    refreshBtn.disabled = false;
  }

  if (embedded) {
    if (embedWarn) embedWarn.hidden = false;
    composeInput.disabled = true;
    composeSend.disabled = true;
    composeInput.placeholder = 'External browser only';
    store.dispatch({ type: 'STATUS', text: 'open 127.0.0.1:3847 in Firefox/Chrome', loading: false });
  } else {
    composeSend.addEventListener('click', () => void submitCompose());
    composeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void submitCompose();
      }
    });
  }

  wsFilterEl.addEventListener('change', () => {
    store.dispatch({ type: 'WS_FILTER', value: wsFilterEl.value });
    render(store.get());
  });

  if (cdpWindowEl) {
    cdpWindowEl.addEventListener('change', () => {
      store.dispatch({ type: 'CDP_WINDOW', title: cdpWindowEl.value });
    });
  }

  refreshBtn.addEventListener('click', () => {
    refreshBtn.disabled = true;
    store.dispatch({ type: 'STATUS', text: 'Refreshing…', loading: true });
    void (async () => {
      try {
        await api.refreshDb();
        await loadList();
        const id = store.get().activeComposerId;
        if (id) await scheduler.refreshChat(id, true);
      } catch (e) {
        store.dispatch({
          type: 'STATUS',
          text: 'Error: ' + (e instanceof Error ? e.message : String(e)),
          loading: false,
        });
      } finally {
        refreshBtn.disabled = false;
      }
    })();
  });

  (window as Window & { crAgent?: { on: typeof agentBus.on } }).crAgent = {
    on: (e, fn) => agentBus.on(e, fn),
  };

  void fetch('/api/db')
    .then((r) => r.json())
    .then((d: { path?: string }) => {
      if (dbPathEl && d.path) {
        const short = d.path.split('/').slice(-3).join('/');
        dbPathEl.textContent = short;
        dbPathEl.title = d.path;
      }
    })
    .catch(() => {});

  scheduler.start();
  void loadList().catch(onListError);
}

if (typeof document !== 'undefined') {
  boot();
}
