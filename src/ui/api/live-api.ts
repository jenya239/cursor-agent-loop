import type { CrApi } from './cr-api';
import type {
  ChatDetailResponse,
  ChatsPayload,
  CursorSnapshot,
  SendResponse,
  StoreStatus,
} from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export class LiveApi implements CrApi {
  async snapshot(composerId?: string): Promise<CursorSnapshot> {
    const params = new URLSearchParams();
    if (composerId) params.set('composerId', composerId);
    const q = params.toString();
    return json(await fetch(`/api/cursor/snapshot${q ? `?${q}` : ''}`));
  }

  async chat(composerId: string, fresh = false): Promise<ChatDetailResponse> {
    const q = fresh ? '?fresh=1' : '';
    return json(await fetch(`/api/chats/${encodeURIComponent(composerId)}${q}`));
  }

  async send(text: string, composerId?: string, windowTitle?: string): Promise<SendResponse> {
    return json(
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, composerId, windowTitle }),
      })
    );
  }

  async refreshDb(): Promise<StoreStatus> {
    return json(await fetch('/api/refresh', { method: 'POST' }));
  }

  async listChats(): Promise<ChatsPayload> {
    return json(await fetch('/api/chats'));
  }

  async status(): Promise<StoreStatus> {
    return json(await fetch('/api/status'));
  }
}
