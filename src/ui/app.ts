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

  let lastSendAt = 0;
  let lastSendText = '';

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

  function render(s: ReturnType<CrStore['get']>) {
    const panel = agentPanelModel(s);
    applyAgentPanel(agentPanelEl, panel);
    agentIndicatorEl.textContent = `AGENT · ${s.agentBusy ? 'работает' : 'ждёт'}`;
    agentIndicatorEl.className = `agent-indicator ${s.agentBusy ? 'busy' : 'idle'}`;
    agentIndicatorEl.title = agentPanelEl.textContent;

    statusEl.textContent = s.status;
    statusEl.classList.toggle('loading', s.statusLoading);

    const filtered = filterChats(s.chats, s.wsFilter);
    listEl.innerHTML = renderListHtml(filtered, s.activeComposerId);
    listEl.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        void openChat((el as HTMLElement).dataset.id!);
      });
    });

    if (cdpWindowEl && s.snapshot) {
      const cur = s.cdpWindowTitle;
      const opts = cdpWindowOptions(s);
      cdpWindowEl.innerHTML =
        '<option value="">окно CDP (авто)</option>' +
        opts.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
      if (cur && [...cdpWindowEl.options].some((o) => o.value === cur)) {
        cdpWindowEl.value = cur;
      }
    }
  }

  store.subscribe(render);

  async function loadList() {
    const [snap, st] = await Promise.all([api.snapshot(), api.status()]);
    store.dispatch({ type: 'SNAPSHOT', snap, agentEvent: null });
    store.dispatch({
      type: 'SET_CHATS',
      chats: snap.chats,
      partial: st.partial,
      loading: st.loading,
    });
    const s = store.get();
    const n = filterChats(s.chats, s.wsFilter).length;
    const partial = st.partial ? ' ·~' : '';
    const live = s.activeComposerId ? ' · live' : '';
    if (st.loading) {
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
    fillWorkspaceFilter(snap.chats);
  }

  function fillWorkspaceFilter(chats: import('./api/types').ChatSummary[]) {
    const cur = wsFilterEl.value;
    const items = workspaceOptions(chats);
    wsFilterEl.innerHTML =
      '<option value="">все</option>' +
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
    chatEl.innerHTML = '<p class="loading">Загрузка…</p>';
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
        'Выбранный чат может не совпадать с активным composer в Cursor. Отправить всё равно?'
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
    store.dispatch({ type: 'STATUS', text: 'Отправка…', loading: true });
    try {
      const r = await api.send(draft, s.activeComposerId, s.cdpWindowTitle || undefined);
      const where = r.pageTitle ? ` → ${r.pageTitle}` : '';
      store.dispatch({ type: 'STATUS', text: `отправлено${where}`, loading: false });
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
        text: 'Ошибка: ' + (e instanceof Error ? e.message : String(e)),
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
    store.dispatch({ type: 'STATUS', text: 'Ошибка', loading: false });
    refreshBtn.disabled = false;
  }

  if (embedded) {
    if (embedWarn) embedWarn.hidden = false;
    composeInput.disabled = true;
    composeSend.disabled = true;
    composeInput.placeholder = 'Только из внешнего браузера';
    store.dispatch({ type: 'STATUS', text: 'открой 127.0.0.1:3847 в Firefox/Chrome', loading: false });
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
    store.dispatch({ type: 'STATUS', text: 'Обновление…', loading: true });
    void (async () => {
      try {
        await api.refreshDb();
        await loadList();
        const id = store.get().activeComposerId;
        if (id) await scheduler.refreshChat(id, true);
      } catch (e) {
        store.dispatch({
          type: 'STATUS',
          text: 'Ошибка: ' + (e instanceof Error ? e.message : String(e)),
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

  scheduler.start();
  void loadList().catch(onListError);
}

if (typeof document !== 'undefined') {
  boot();
}
