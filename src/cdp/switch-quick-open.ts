import { connectCdp, pickWorkbenchWithComposer, type CdpTarget } from './client';

/** Fallback: Cmd/Ctrl+P then type chat id/name (v2). */
export async function switchViaQuickOpen(
  targets: CdpTarget[],
  query: string,
  windowTitle?: string
): Promise<{ ok: boolean; reason: string; switchTarget?: string }> {
  const q = query.trim();
  if (!q) return { ok: false, reason: 'no-query' };

  let page = await pickWorkbenchWithComposer(targets);
  if (windowTitle) {
    const match = targets.find((t) => (t.title || '').includes(windowTitle));
    if (match) page = match;
  }
  if (!page) return { ok: false, reason: 'no-window' };

  const mod = process.platform === 'darwin' ? 4 : 2;
  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');
    for (const phase of ['keyDown', 'keyUp'] as const) {
      await send('Input.dispatchKeyEvent', {
        type: phase,
        key: 'p',
        code: 'KeyP',
        windowsVirtualKeyCode: 80,
        modifiers: mod,
      });
    }
    await new Promise((r) => setTimeout(r, 120));
    await send('Input.insertText', { text: q });
    await new Promise((r) => setTimeout(r, 80));
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
    return { ok: true, reason: 'quick-open', switchTarget: page.title };
  } finally {
    close();
  }
}
