import {
  checkCdpAvailable,
  connectCdp,
  cdpBaseUrl,
  listTargets,
  pickWorkbenchWithComposer,
} from './client';

const FIND_INPUT_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { ok: false, reason: 'no-bar' };
  const el = bar.querySelector("[contenteditable='true'], [contenteditable=true]");
  if (!el) return { ok: false, reason: 'no-input' };
  el.scrollIntoView({ block: 'nearest' });
  el.focus();
  el.click();
  const r = el.getBoundingClientRect();
  const active = document.activeElement;
  return {
    ok: true,
    sel: '.composer-bar [contenteditable]',
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    inBar: active ? bar.contains(active) : false,
    inputCls: (el.className || '').toString().slice(0, 60),
  };
})()`;

const SUBMIT_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { ok: false, reason: 'no-bar' };
  if (bar.querySelector('.codicon-debug-stop')) {
    return { ok: false, reason: 'agent-running' };
  }
  for (const btn of bar.querySelectorAll('.anysphere-icon-button, button, [role="button"]')) {
    if (btn.querySelector('.codicon-arrow-up')) {
      btn.click();
      return { ok: true, how: 'arrow-up' };
    }
  }
  const legacy =
    bar.querySelector('button.composer-send-button:not([disabled])') ||
    bar.querySelector('[data-testid="composer-send-button"]:not([disabled])');
  if (legacy) {
    legacy.click();
    return { ok: true, how: 'legacy-btn' };
  }
  return { ok: false, reason: 'no-send-btn' };
})()`;

export interface SendResult {
  ok: true;
  text: string;
  selector: string;
  pageTitle: string;
  inBar?: boolean;
  submitHow?: string;
}

export async function sendComposerMessage(
  text: string,
  opts?: { windowTitle?: string }
): Promise<SendResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty message');

  const base = cdpBaseUrl();
  if (!(await checkCdpAvailable(base))) {
    throw new Error('cdp unavailable (is Cursor running with --remote-debugging-port?)');
  }

  const targets = await listTargets(base);
  let page = await pickWorkbenchWithComposer(targets);
  if (opts?.windowTitle) {
    const match = targets.find((t) => (t.title || '').includes(opts.windowTitle!));
    if (match) page = match;
  }
  if (!page) throw new Error('no Cursor window with composer');

  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');

    const found = (await send('Runtime.evaluate', {
      expression: FIND_INPUT_JS,
      returnByValue: true,
    })) as {
      result?: {
        value?: {
          ok: boolean;
          reason?: string;
          sel?: string;
          x: number;
          y: number;
          inBar?: boolean;
        };
      };
    };

    const info = found?.result?.value;
    if (!info?.ok || info.sel == null) {
      throw new Error(`composer ${info?.reason || 'input not found'}`);
    }
    if (info.inBar === false) {
      throw new Error('focus not in composer-bar');
    }

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

    let submitted = (await send('Runtime.evaluate', {
      expression: SUBMIT_JS,
      returnByValue: true,
    })) as { result?: { value?: { ok?: boolean; reason?: string; how?: string } } };

    let sub = submitted?.result?.value;
    if (!sub?.ok && sub?.reason === 'no-send-btn') {
      const enterMod = process.platform === 'darwin' ? 8 : 2;
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        modifiers: enterMod,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        modifiers: enterMod,
      });
      sub = { ok: true, how: 'mod-enter' };
    }

    if (!sub?.ok) {
      const why = sub?.reason || 'submit failed';
      if (why === 'agent-running') {
        throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
      }
      throw new Error(`composer ${why}`);
    }

    return {
      ok: true,
      text: trimmed,
      selector: info.sel,
      pageTitle: page.title,
      inBar: info.inBar,
      submitHow: sub.how,
    };
  } finally {
    close();
  }
}
