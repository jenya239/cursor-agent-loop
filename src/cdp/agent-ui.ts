import { connectCdp, listTargets, pickWorkbenchWithComposer } from './client';

const BUSY_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  if (!bar) return { busy: false, reason: 'no-bar' };
  const root = bar.closest('.composer-bar-container') || bar;
  const stop = root.querySelector(
    '[aria-label*="Stop" i], [aria-label*="останов" i], [data-testid*="stop" i], button.composer-stop-button, .composer-stop-button'
  );
  if (stop && !stop.disabled) return { busy: true, reason: 'stop-btn' };
  const send = root.querySelector(
    'button.composer-send-button, [data-testid="composer-send-button"]'
  );
  const sendLabel = send?.getAttribute('aria-label') || '';
  if (/stop|cancel|abort|останов/i.test(sendLabel)) return { busy: true, reason: 'send-stop' };
  const spinner = root.querySelector(
    '[aria-busy="true"], .composer-loading, .composer-generating, [class*="generating" i]'
  );
  if (spinner) return { busy: true, reason: 'spinner' };
  const busyText = (root.textContent || '').slice(0, 500);
  if (/generating|stop generating|останов/i.test(busyText) && stop) return { busy: true, reason: 'text' };
  return { busy: false, reason: 'idle' };
})()`;

export async function readComposerAgentBusy(): Promise<boolean> {
  const page = await pickWorkbenchWithComposer(await listTargets());
  if (!page) return false;
  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');
    const r = (await send('Runtime.evaluate', {
      expression: BUSY_JS,
      returnByValue: true,
    })) as { result?: { value?: { busy?: boolean } } };
    return !!r.result?.value?.busy;
  } finally {
    close();
  }
}
