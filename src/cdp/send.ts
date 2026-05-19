import {
  checkCdpAvailable,
  connectCdp,
  cdpBaseUrl,
  listTargets,
  pickWorkbenchPage,
} from './client';

const INPUT_SELECTORS = [
  ".composer-bar [contenteditable='true']",
  "#workbench\\.parts\\.auxiliarybar [contenteditable='true']",
  "div.composer-bar.editor [contenteditable='true']",
  "[contenteditable='true']",
];

const FIND_INPUT_JS = `(() => {
  const sels = ${JSON.stringify(INPUT_SELECTORS)};
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.scrollIntoView({ block: 'nearest' });
    el.focus();
    el.click();
    const r = el.getBoundingClientRect();
    return { ok: true, sel, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { ok: false };
})()`;

export interface SendResult {
  ok: true;
  text: string;
  selector: string;
  pageTitle: string;
}

export async function sendComposerMessage(text: string): Promise<SendResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty message');

  const base = cdpBaseUrl();
  if (!(await checkCdpAvailable(base))) {
    throw new Error('cdp unavailable (is Cursor running with --remote-debugging-port?)');
  }

  const targets = await listTargets(base);
  const page = pickWorkbenchPage(targets);
  if (!page) throw new Error('no Cursor workbench page');

  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');

    const found = (await send('Runtime.evaluate', {
      expression: FIND_INPUT_JS,
      returnByValue: true,
    })) as { result?: { value?: { ok: boolean; sel?: string; x: number; y: number } } };

    const info = found?.result?.value;
    if (!info?.ok || info.sel == null) throw new Error('composer input not found');

    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: info.x,
      y: info.y,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: info.x,
      y: info.y,
      button: 'left',
      clickCount: 1,
    });

    const mod = process.platform === 'darwin' ? 4 : 2;
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      windowsVirtualKeyCode: 65,
      modifiers: mod,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA',
      windowsVirtualKeyCode: 65,
      modifiers: mod,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Backspace',
      code: 'Backspace',
      windowsVirtualKeyCode: 8,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Backspace',
      code: 'Backspace',
      windowsVirtualKeyCode: 8,
    });

    await send('Input.insertText', { text: trimmed });

    const submitted = (await send('Runtime.evaluate', {
      expression: `(() => {
        const bar = document.querySelector('.composer-bar');
        if (!bar) return false;
        const btn =
          bar.querySelector('button.composer-send-button') ||
          bar.querySelector('[data-testid="composer-send-button"]') ||
          [...bar.querySelectorAll('button')].find((b) =>
            /send|отправ/i.test(b.getAttribute('aria-label') || b.textContent || '')
          );
        if (btn) { btn.click(); return true; }
        return false;
      })()`,
      returnByValue: true,
    })) as { result?: { value?: boolean } };

    if (!submitted?.result?.value) {
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
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
    }

    return { ok: true, text: trimmed, selector: info.sel, pageTitle: page.title };
  } finally {
    close();
  }
}
