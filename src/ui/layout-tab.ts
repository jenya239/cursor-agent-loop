import type { CursorLayoutSnapshot } from '../cursor/layout/types';
import { renderLayoutTreeHtml } from './views/render-layout-tree';

export async function loadLayoutSnapshot(
  fetchFn: (url: string) => Promise<Response> = fetch
): Promise<{ snap: CursorLayoutSnapshot | null; err?: string }> {
  const r = await fetchFn('/api/cursor/layout');
  const ct = r.headers.get('content-type') || '';
  if (!r.ok) {
    if (ct.includes('json')) {
      const body = (await r.json()) as { error?: string };
      return { snap: null, err: body.error || r.statusText };
    }
    return { snap: null, err: r.statusText };
  }
  return { snap: (await r.json()) as CursorLayoutSnapshot };
}

export async function loadLayoutPanelHtml(
  fetchFn: (url: string) => Promise<Response> = fetch
): Promise<string> {
  const { snap, err } = await loadLayoutSnapshot(fetchFn);
  return renderLayoutTreeHtml(snap, err);
}
