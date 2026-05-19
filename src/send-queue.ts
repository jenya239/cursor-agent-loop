import crypto from 'crypto';

export interface QueuedSend {
  id: string;
  at: number;
  text: string;
  composerId?: string;
  windowTitle?: string;
}

export class SendQueue {
  private readonly items: QueuedSend[] = [];

  enqueue(
    text: string,
    opts?: { composerId?: string; windowTitle?: string }
  ): QueuedSend {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('empty message');
    const item: QueuedSend = {
      id: crypto.randomUUID(),
      at: Date.now(),
      text: trimmed,
      composerId: opts?.composerId,
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

  unshift(item: QueuedSend): void {
    this.items.unshift(item);
  }
}

export function isAgentBusySendError(message: string): boolean {
  return message.includes('агент сейчас работает');
}
