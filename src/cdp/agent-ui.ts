import { connectCdp, composerPageOrder, listTargets } from './client';
import type { CdpTarget } from './client';

const BUSY_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { busy: false, reason: 'no-bar' };
  if (bar.querySelector('.codicon-debug-stop')) return { busy: true, reason: 'stop-icon' };
  const root = bar.closest('.composer-bar-container') || bar;
  const stopBtn = root.querySelector(
    '.codicon-debug-stop, [aria-label*="Stop" i], [aria-label*="останов" i], button.composer-stop-button'
  );
  if (stopBtn) return { busy: true, reason: 'stop-control' };
  const send = root.querySelector(
    'button.composer-send-button, [data-testid="composer-send-button"]'
  );
  const sendLabel = send?.getAttribute('aria-label') || '';
  if (/stop|cancel|abort|останов/i.test(sendLabel)) return { busy: true, reason: 'send-label' };
  if (root.querySelector('[aria-busy="true"], .composer-loading, .composer-generating')) {
    return { busy: true, reason: 'spinner' };
  }
  return { busy: false, reason: 'idle' };
})()`;

async function probePage(page: CdpTarget): Promise<{ busy: boolean; reason: string; title: string }> {
  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');
    const r = (await send('Runtime.evaluate', {
      expression: BUSY_JS,
      returnByValue: true,
    })) as { result?: { value?: { busy?: boolean; reason?: string } } };
    const v = r.result?.value;
    return {
      busy: !!v?.busy,
      reason: v?.reason || 'unknown',
      title: page.title,
    };
  } finally {
    close();
  }
}

export async function readComposerAgentBusy(): Promise<boolean> {
  const r = await readComposerAgentDetail();
  return r.busy;
}

export async function readComposerAgentDetail(): Promise<{
  busy: boolean;
  cdpOk: boolean;
  reason: string;
  windowTitle?: string;
}> {
  const pages = composerPageOrder(await listTargets());
  if (!pages.length) {
    return { busy: false, cdpOk: false, reason: 'no-window' };
  }
  let first: { busy: boolean; reason: string; title: string } | null = null;
  for (const page of pages) {
    try {
      const p = await probePage(page);
      if (!first) first = p;
      if (p.busy) {
        return { busy: true, cdpOk: true, reason: p.reason, windowTitle: p.title };
      }
    } catch {
      /* try next */
    }
  }
  if (first) {
    return { busy: false, cdpOk: true, reason: first.reason, windowTitle: first.title };
  }
  return { busy: false, cdpOk: false, reason: 'cdp-error' };
}
