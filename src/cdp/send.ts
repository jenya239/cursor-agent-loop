import { runComposerSend, type ComposerSendResult } from './composer-send';
import { liveCdp } from './live-cdp';

export type SendResult = ComposerSendResult & { selector: string };

/** @deprecated use CdpPort.sendMessage / LiveCdp */
export async function sendComposerMessage(
  text: string,
  opts?: { windowTitle?: string }
): Promise<SendResult> {
  const r = await runComposerSend(liveCdp, text, opts);
  return {
    ...r,
    selector: '.composer-bar [contenteditable]',
  };
}
