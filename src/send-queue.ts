import crypto from 'crypto';

export interface QueuedSend {
  id: string;
  at: number;
  text: string;
  token?: string;
  composerId?: string;
  windowTitle?: string;
}

export class SendQueue {
  private readonly items: QueuedSend[] = [];

  enqueue(
    text: string,
    opts?: { token?: string; composerId?: string; windowTitle?: string }
  ): QueuedSend {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('empty message');
    const item: QueuedSend = {
      id: crypto.randomUUID(),
      at: Date.now(),
      text: trimmed,
      composerId: opts?.composerId,
      token: opts?.token,
      windowTitle: opts?.windowTitle,
    };
    this.items.push(item);
    return item;
  }

  list(): QueuedSend[] {
    return [...this.items];
  }

  get length(): number {
    return this.items.length;
  }

  peek(): QueuedSend | undefined {
    return this.items[0];
  }

  shift(): QueuedSend | undefined {
    return this.items.shift();
  }

  remove(id: string): boolean {
    const i = this.items.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this.items.splice(i, 1);
    return true;
  }

  unshift(item: QueuedSend): void {
    this.items.unshift(item);
  }
}

export function isAgentBusySendError(message: string): boolean {
  return (
    message.includes('агент сейчас работает') ||
    message.includes('composer submit failed') ||
    message.includes('revert modal') ||
    message.includes('composer not empty')
  );
}
