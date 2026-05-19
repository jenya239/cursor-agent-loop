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

export function pickWorkbenchPage(targets: CdpTarget[]): CdpTarget | undefined {
  return (
    targets.find((t) => t.type === 'page' && (t.url || '').includes('workbench.html')) ||
    targets.find((t) => t.type === 'page' && (t.title || '').includes('Cursor'))
  );
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
