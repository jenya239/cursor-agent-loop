(function () {
  const bus = new EventTarget();
  let busy = false;

  function emit(type, detail) {
    bus.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function on(type, fn) {
    bus.addEventListener(type, fn);
    return () => bus.removeEventListener(type, fn);
  }

  function sync(chat, activeComposerId) {
    const id = chat.composerId;
    if (!activeComposerId || id !== activeComposerId) {
      return { busy, event: null };
    }
    const next = !!chat.agentBusy;
    const detail = {
      composerId: activeComposerId,
      agentStatus: chat.agentStatus,
      messageCount: (chat.messages || []).length,
    };
    let event = null;
    if (next !== busy) {
      busy = next;
      event = next ? 'agent:busy' : 'agent:idle';
      emit(event, detail);
    }
    return { busy, event, detail };
  }

  function expectBusy(activeComposerId) {
    if (!activeComposerId || busy) return;
    busy = true;
    emit('agent:busy', { composerId: activeComposerId, messageCount: 0 });
  }

  function reset() {
    busy = false;
  }

  window.crAgent = { on, sync, expectBusy, reset, get busy() { return busy; } };
})();
