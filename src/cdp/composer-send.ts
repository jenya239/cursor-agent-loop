import {
  connectCdp,
  pickWorkbenchWithComposer,
} from './client';
import { isFixtureCdp } from './fixture-cdp';
import {
  DISMISS_REVERT_MODAL_JS,
  FOCUS_CLEAR_INPUT_JS,
  REVERT_MODAL_JS,
  SUBMIT_COMPOSER_JS,
} from './composer-input';
import { probeComposerAgentWindow } from './composer-agent-probe';
import { COMPOSER_AGENT_PROBE_V2_JS } from './probes/composer-agent.v2';
import {
  COMPOSER_AGENT_PROBE_JS,
  parseComposerAgentProbeValue,
} from './probes/composer-agent.v1';
import type { CdpPort } from './port';

export interface ComposerSendResult {
  ok: true;
  text: string;
  pageTitle: string;
  submitHow?: string;
}

async function dispatchEscape(
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
  }
}

async function probeBusyOnPage(
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
): Promise<{ busy: boolean; reason: string } | null> {
  for (const expression of [COMPOSER_AGENT_PROBE_V2_JS, COMPOSER_AGENT_PROBE_JS]) {
    const probe = (await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    })) as { result?: { value?: unknown } };
    const agent = parseComposerAgentProbeValue(probe.result?.value);
    if (agent) return { busy: agent.busy, reason: agent.reason };
  }
  return null;
}

async function evalModal(
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  expression: string
): Promise<{ open?: boolean; action?: string } | null> {
  const r = (await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })) as { result?: { value?: { open?: boolean; action?: string } } };
  return r.result?.value ?? null;
}

async function liveComposerSend(
  cdp: CdpPort,
  trimmed: string,
  windowTitle?: string
): Promise<ComposerSendResult> {
  const targets = await cdp.listTargets();
  let page = await pickWorkbenchWithComposer(targets);
  if (windowTitle) {
    const match = targets.find((t) => (t.title || '').includes(windowTitle));
    if (match) page = match;
  }
  if (!page) throw new Error('no Cursor window with composer');

  const busy = await probeComposerAgentWindow(cdp, page.title);
  if (busy.cdpOk && busy.busy) {
    throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
  }

  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');

    const dismissed = await evalModal(send, DISMISS_REVERT_MODAL_JS);
    if (dismissed?.open && dismissed.action === 'continue-without-revert') {
      return { ok: true, text: trimmed, pageTitle: page.title, submitHow: 'modal-continue' };
    }
    if (dismissed?.open) {
      await dispatchEscape(send);
    }

    const agent = await probeBusyOnPage(send);
    if (agent?.busy) {
      throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
    }

    const tryFocusClear = async () =>
      (
        (await send('Runtime.evaluate', {
          expression: FOCUS_CLEAR_INPUT_JS,
          returnByValue: true,
        })) as {
          result?: {
            value?: {
              ok: boolean;
              reason?: string;
              x: number;
              y: number;
              inBar?: boolean;
              draftLen?: number;
            };
          };
        }
      )?.result?.value;

    let info = await tryFocusClear();
    if (!info?.ok && info?.reason === 'composer-not-empty') {
      const GET_POS = `(() => { const el = document.querySelector('.composer-bar [contenteditable="true"]') || document.querySelector(".ui-prompt-input [contenteditable='true']"); if(!el) return null; el.focus(); el.click(); const r = el.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; })()`;
      const pos = (
        (await send('Runtime.evaluate', { expression: GET_POS, returnByValue: true })) as {
          result?: { value?: { x: number; y: number } };
        }
      )?.result?.value;
      if (pos) {
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: pos.x,
          y: pos.y,
          button: 'left',
          clickCount: 1,
        });
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: pos.x,
          y: pos.y,
          button: 'left',
          clickCount: 1,
        });
        await new Promise((r) => setTimeout(r, 150));
        for (const [k, code, vk, mod] of [
          ['a', 'KeyA', 65, 2],
          ['Backspace', 'Backspace', 8, 0],
        ] as [string, string, number, number][]) {
          await send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: k,
            code,
            windowsVirtualKeyCode: vk,
            modifiers: mod,
          });
          await send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: k,
            code,
            windowsVirtualKeyCode: vk,
            modifiers: mod,
          });
          await new Promise((r) => setTimeout(r, 100));
        }
        await new Promise((r) => setTimeout(r, 400));
        await evalModal(send, DISMISS_REVERT_MODAL_JS);
        await new Promise((r) => setTimeout(r, 200));
        info = await tryFocusClear();
      }
    }
    if (!info?.ok) {
      const why = info?.reason || 'input not found';
      throw new Error(
        why === 'composer-not-empty'
          ? `composer not empty (draft ${info?.draftLen ?? '?'} chars) — clear field manually; revert modal if open`
          : `composer ${why}`
      );
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

    await send('Input.insertText', { text: trimmed });

    const buttonSubmit = (await send('Runtime.evaluate', {
      expression: SUBMIT_COMPOSER_JS,
      returnByValue: true,
    })) as { result?: { value?: { ok?: boolean; reason?: string; how?: string } } };

    const sub = buttonSubmit?.result?.value;
    if (!sub?.ok) {
      const why = sub?.reason || 'no-send-btn';
      if (why === 'agent-busy') {
        throw new Error('агент сейчас работает — дождитесь или нажмите Stop');
      }
      throw new Error(`composer submit failed: ${why}`);
    }

    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const modal = await evalModal(send, REVERT_MODAL_JS);
      if (!modal?.open) break;
      const action = await evalModal(send, DISMISS_REVERT_MODAL_JS);
      if (action?.action === 'continue-without-revert') {
        return {
          ok: true,
          text: trimmed,
          pageTitle: page.title,
          submitHow: `${sub.how}+modal-continue`,
        };
      }
      await dispatchEscape(send);
      throw new Error('composer revert modal — submit aborted');
    }

    return {
      ok: true,
      text: trimmed,
      pageTitle: page.title,
      submitHow: sub.how,
    };
  } finally {
    close();
  }
}

export async function runComposerSend(
  cdp: CdpPort,
  text: string,
  opts?: { windowTitle?: string }
): Promise<ComposerSendResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty message');
  if (!(await cdp.isAvailable())) {
    throw new Error('cdp unavailable (is Cursor running with --remote-debugging-port?)');
  }

  await cdp.dismissModals();

  if (isFixtureCdp(cdp)) {
    const r = await cdp.sendMessage(trimmed, { windowTitle: opts?.windowTitle });
    return { ok: true, text: r.text, pageTitle: r.pageTitle, submitHow: r.submitHow };
  }

  return liveComposerSend(cdp, trimmed, opts?.windowTitle);
}
