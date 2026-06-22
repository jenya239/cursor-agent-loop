import { connectCdp, type CdpSendFn, type CdpTarget } from './client';

export async function withPage<T>(
  page: CdpTarget,
  fn: (send: CdpSendFn) => Promise<T>
): Promise<T> {
  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    return await fn(send);
  } finally {
    close();
  }
}

export async function evalOnPage(
  page: CdpTarget,
  expression: string,
  returnByValue = true
): Promise<unknown> {
  const r = (await withPage(page, (send) =>
    send('Runtime.evaluate', { expression, returnByValue })
  )) as { result?: { value?: unknown } };
  return returnByValue ? r?.result?.value : r?.result;
}
