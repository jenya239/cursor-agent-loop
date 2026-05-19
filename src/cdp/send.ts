import { runComposerSend, type ComposerSendResult } from './composer-send';

export type SendResult = ComposerSendResult & { selector: string };

/** @deprecated use CdpPort.sendMessage / LiveCdp */
export async function sendComposerMessage(
  text: string,
  opts?: { windowTitle?: string }
): Promise<SendResult> {
  const r = await runComposerSend(text, opts);
  return {
    ...r,
    selector: '.composer-bar [contenteditable]',
  };
}
