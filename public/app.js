const listEl = document.getElementById('list');
const chatEl = document.getElementById('chat');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');
const wsFilterEl = document.getElementById('ws-filter');
const composeInput = document.getElementById('compose-input');
const composeSend = document.getElementById('compose-send');
let activeId = null;
let sending = false;
let lastSendAt = 0;
let lastSendText = '';
const SEND_COOLDOWN_MS = 2500;
let listPollTimer = null;
let chatPollTimer = null;
let lastChatSig = '';
let allChats = [];

const CHAT_POLL_MS = 1000;

refreshBtn.addEventListener('click', () => refreshServer());
wsFilterEl.addEventListener('change', () => renderList(filterChats(allChats)));

function setComposeEnabled(on) {
  composeInput.disabled = !on || sending;
  composeSend.disabled = !on || sending;
}

composeSend.addEventListener('click', () => submitCompose());

composeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    submitCompose();
  }
});

window.addEventListener(
  'keydown',
  (e) => {
    if (sending && e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true
);

async function submitCompose() {
  const text = composeInput.value.trim();
  if (!text || !activeId || sending) return;
  const now = Date.now();
  if (text === lastSendText && now - lastSendAt < SEND_COOLDOWN_MS) return;
  if (now - lastSendAt < 800) return;

  const draft = text;
  sending = true;
  lastSendAt = now;
  lastSendText = draft;
  composeInput.value = '';
  composeInput.blur();
  setComposeEnabled(false);
  stopChatPoll();

  const prevStatus = statusEl.textContent;
  setStatus('Отправка…', true);
  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: draft, composerId: activeId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    await loadChat(activeId, { silent: true, force: true, pinBottom: true });
    setStatus(prevStatus, false);
  } catch (e) {
    composeInput.value = draft;
    setStatus('Ошибка: ' + e.message, false);
    lastSendText = '';
  } finally {
    sending = false;
    setComposeEnabled(!!activeId);
    if (activeId) startChatPoll(activeId);
  }
}

function setStatus(text, loading) {
  statusEl.textContent = text;
  statusEl.classList.toggle('loading', !!loading);
}

function filterChats(chats) {
  const v = wsFilterEl.value;
  if (!v) return chats;
  return chats.filter(
    (c) => c.workspaceId === v || c.workspaceLabel === v || c.workspacePath === v
  );
}

function fillWorkspaceFilter(chats) {
  const cur = wsFilterEl.value;
  const map = new Map();
  for (const c of chats) {
    const key = c.workspaceId || c.workspaceLabel || '—';
    if (!map.has(key)) {
      map.set(key, { key, label: c.workspaceLabel || '—', path: c.workspacePath || '' });
    }
  }
  const items = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
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

function shortPath(p) {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/');
  return parts.slice(-2).join('/');
}

async function refreshServer() {
  refreshBtn.disabled = true;
  setStatus('Обновление…', true);
  try {
    await fetch('/api/refresh', { method: 'POST' });
    await loadList();
    if (activeId) await loadChat(activeId, { silent: true, force: true });
  } catch (e) {
    setStatus('Ошибка: ' + e.message, false);
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderList(chats) {
  if (!chats.length) {
    listEl.innerHTML = '<p class="hint">Чатов нет</p>';
    return;
  }
  const groups = new Map();
  for (const c of chats) {
    const g = c.workspaceLabel || '—';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
  let html = '';
  for (const label of labels) {
    const items = groups.get(label);
    const sample = items[0];
    const pathHint = sample.workspacePath ? shortPath(sample.workspacePath) : '';
    html += `<div class="ws-hdr" title="${esc(sample.workspacePath || '')}">${esc(label)}${pathHint ? ` <span class="ws-path">${esc(pathHint)}</span>` : ''}</div>`;
    for (const c of items) {
      const mode = (c.unifiedMode || '?').slice(0, 2);
      html += `<a class="item${c.composerId === activeId ? ' active' : ''}" data-id="${c.composerId}" title="${esc(c.name)}">
      <span class="mode">${esc(mode)}</span><span class="name">${esc(c.name)}</span></a>`;
    }
  }
  listEl.innerHTML = html;
  listEl.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openChat(el.dataset.id);
    });
  });
}

async function loadList() {
  const [chatsRes, stRes] = await Promise.all([
    fetch('/api/chats'),
    fetch('/api/status'),
  ]);
  if (!chatsRes.ok) throw new Error(await chatsRes.text());
  const body = await chatsRes.json();
  const st = stRes.ok ? await stRes.json() : {};

  allChats = body.chats || body;
  fillWorkspaceFilter(allChats);
  renderList(filterChats(allChats));

  const n = filterChats(allChats).length;
  const partial = body.partial || st.partial ? ' ·~' : '';
  const live = activeId ? ' · live' : '';
  if (st.loading || body.loading) {
    setStatus(`${n}…`, true);
    scheduleListPoll();
  } else {
    setStatus(`${n}${partial}${live}`, false);
    stopListPoll();
    refreshBtn.disabled = false;
  }
}

function scheduleListPoll() {
  stopListPoll();
  listPollTimer = setTimeout(() => loadList().catch(onListError), 1500);
}

function stopListPoll() {
  if (listPollTimer) clearTimeout(listPollTimer);
  listPollTimer = null;
}

function stopChatPoll() {
  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = null;
}

function chatSignature(data) {
  const msgs = data.messages || [];
  if (!msgs.length) return '0';
  const last = msgs[msgs.length - 1];
  return `${msgs.length}:${last.bubbleId}:${(last.text || '').length}`;
}

function chatAtBottom(threshold = 80) {
  return chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= threshold;
}

function scrollChatBottom() {
  const go = () => {
    const end = document.getElementById('chat-end');
    if (end) {
      end.scrollIntoView({ block: 'end' });
    } else {
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  };
  go();
  requestAnimationFrame(() => {
    go();
    requestAnimationFrame(go);
  });
  setTimeout(go, 50);
}

function renderChat(data, pinBottom) {
  const ws = data.workspacePath
    ? `<span class="chat-ws">${esc(shortPath(data.workspacePath))}</span> `
    : data.workspaceLabel
      ? `<span class="chat-ws">${esc(data.workspaceLabel)}</span> `
      : '';
  const title = esc(data.name || '—');
  const tag = (m) => {
    if (m.role === 'user') return 'u';
    return (m.text || '').startsWith('[') ? 't' : 'a';
  };
  const body = (data.messages || [])
    .map(
      (m) =>
        `<article class="msg ${m.role}${(m.text || '').startsWith('[') ? ' tool' : ''}"><span class="tag">${tag(m)}</span><pre>${esc(m.text || '')}</pre></article>`
    )
    .join('');
  chatEl.innerHTML = `<div class="chat-hdr">${ws}${title} <span class="msg-count">${(data.messages || []).length}</span></div>${body || '<p class="hint">пусто</p>'}<div id="chat-end" aria-hidden="true"></div>`;

  if (pinBottom) scrollChatBottom();
}

async function loadChat(id, opts = {}) {
  const { silent = false, force = false, pinBottom: pin } = opts;
  if (!silent) chatEl.innerHTML = '<p class="loading">Загрузка…</p>';

  const res = await fetch(`/api/chats/${encodeURIComponent(id)}?fresh=1`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  const sig = chatSignature(data);
  if (!force && sig === lastChatSig) return data;
  lastChatSig = sig;
  const pinBottom = pin ?? (!silent || chatAtBottom());
  renderChat(data, pinBottom);
  return data;
}

function startChatPoll(id) {
  stopChatPoll();
  chatPollTimer = setInterval(() => {
    if (activeId !== id) return;
    loadChat(id, { silent: true }).catch(() => {});
  }, CHAT_POLL_MS);
}

function onListError(e) {
  listEl.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  setStatus('Ошибка', false);
  refreshBtn.disabled = false;
}

async function openChat(id) {
  stopChatPoll();
  activeId = id;
  lastChatSig = '';
  setComposeEnabled(true);

  try {
    await loadChat(id, { force: true, pinBottom: true });
    await loadList();
    startChatPoll(id);
    composeInput.focus();
  } catch (e) {
    chatEl.innerHTML = `<p class="err">${esc(e.message)}</p>`;
    setComposeEnabled(false);
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

setStatus('Загрузка…', true);
refreshBtn.disabled = true;
loadList().catch(onListError);
