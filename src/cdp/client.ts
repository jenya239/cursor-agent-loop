import http from 'http';

export interface CdpTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export function cdpBaseUrl(port = Number(process.env.CDP_PORT) || 9226): string {
  return process.env.CDP_URL || `http://127.0.0.1:${port}`;
}

export function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function listTargets(base = cdpBaseUrl()): Promise<CdpTarget[]> {
  return fetchJson<CdpTarget[]>(`${base}/json`);
}

const SKIP_TITLE = /settings|walkthrough|welcome|release notes/i;

export function workbenchPages(targets: CdpTarget[]): CdpTarget[] {
  return targets.filter(
    (t) => t.type === 'page' && (t.url || '').includes('workbench.html')
  );
}

/** Prefer a real editor window, not Cursor Settings. */
export function pickWorkbenchPage(targets: CdpTarget[]): CdpTarget | undefined {
  const pages = workbenchPages(targets);
  if (!pages.length) {
    return targets.find((t) => t.type === 'page' && (t.title || '').includes('Cursor'));
  }

  const prefer = process.env.CDP_WINDOW_TITLE;
  if (prefer) {
    const hit = pages.find((t) => (t.title || '').includes(prefer));
    if (hit) return hit;
  }

  const usable = pages.filter((t) => !SKIP_TITLE.test(t.title || ''));
  const pool = usable.length ? usable : pages;

  const score = (t: CdpTarget): number => {
    const title = t.title || '';
    if (prefer && title.includes(prefer)) return 0;
    if (/\bcr\b/i.test(title) && title.includes('Cursor')) return 1;
    return 2;
  };
  return [...pool].sort((a, b) => score(a) - score(b))[0];
}

export function composerPageOrder(targets: CdpTarget[]): CdpTarget[] {
  const pages = workbenchPages(targets).filter((t) => !SKIP_TITLE.test(t.title || ''));
  const prefer = process.env.CDP_WINDOW_TITLE;
  const score = (t: CdpTarget): number => {
    const title = t.title || '';
    if (prefer && title.includes(prefer)) return 0;
    if (/\bcr\b/i.test(title) && title.includes('Cursor')) return 1;
    return 2;
  };
  return [...pages].sort((a, b) => score(a) - score(b));
}

const HAS_COMPOSER_JS = `!!document.querySelector(".composer-bar [contenteditable='true'], .composer-bar [contenteditable=true]")`;

export async function pickWorkbenchWithComposer(
  targets: CdpTarget[]
): Promise<CdpTarget | undefined> {
  const tryList = composerPageOrder(targets);
  const picked = tryList[0] ?? pickWorkbenchPage(targets);

  for (const page of tryList) {
    const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
    try {
      await send('Runtime.enable');
      const r = (await send('Runtime.evaluate', {
        expression: HAS_COMPOSER_JS,
        returnByValue: true,
      })) as { result?: { value?: boolean } };
      if (r.result?.value) return page;
    } catch {
      /* try next window */
    } finally {
      close();
    }
  }
  return picked;
}

export type CdpSendFn = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

export function connectCdp(wsUrl: string): Promise<{ send: CdpSendFn; close: () => void }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

    const send: CdpSendFn = (method, params = {}) =>
      new Promise((res, rej) => {
        const my = id++;
        pending.set(my, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id: my, method, params }));
        setTimeout(() => {
          if (pending.has(my)) {
            pending.delete(my);
            rej(new Error(`cdp timeout: ${method}`));
          }
        }, 15000);
      });

    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(String(ev.data)) as {
        id?: number;
        error?: { message?: string };
        result?: unknown;
      };
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id)!;
        pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message || 'cdp error'));
        else p.resolve(m.result);
      }
    });

    ws.addEventListener('open', () => resolve({ send, close: () => ws.close() }));
    ws.addEventListener('error', () => reject(new Error('cdp websocket failed')));
  });
}

export async function checkCdpAvailable(base = cdpBaseUrl()): Promise<boolean> {
  try {
    await fetchJson<unknown[]>(`${base}/json`);
    return true;
  } catch {
    return false;
  }
}
