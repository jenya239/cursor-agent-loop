import type { BubblePayload } from './types';

type Loose = Record<string, unknown>;

function richTextPlain(rich: unknown): string {
  if (rich == null) return '';
  let node: unknown = rich;
  if (typeof rich === 'string') {
    try {
      node = JSON.parse(rich);
    } catch {
      return rich;
    }
  }
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const o = n as Loose;
    if (typeof o.text === 'string' && o.text) parts.push(o.text);
    if (Array.isArray(o.children)) o.children.forEach(walk);
  };
  walk((node as Loose).root ?? node);
  return parts.join('');
}

function formatToolFormer(d: unknown): string {
  if (!d || typeof d !== 'object') return '';
  const o = d as Loose;
  const name = String(o.name ?? 'tool');
  let line = `[${name}]`;
  if (typeof o.rawArgs === 'string' && o.rawArgs) {
    try {
      const args = JSON.parse(o.rawArgs) as Loose;
      const path = args.path ?? args.targetFile ?? args.command;
      line += path ? ` ${path}` : ` ${o.rawArgs.slice(0, 160)}`;
    } catch {
      line += ` ${o.rawArgs.slice(0, 160)}`;
    }
  }
  if (typeof o.result === 'string' && o.result) {
    try {
      const res = JSON.parse(o.result) as Loose;
      let out = '';
      if (typeof res.stdout === 'string') out = res.stdout;
      else if (typeof res.output === 'string') out = res.output;
      else if (typeof res.contents === 'string') out = res.contents;
      if (out.trim()) line += `\n${out.trim().slice(0, 4000)}`;
    } catch {
      /* ignore */
    }
  }
  return line;
}

function codeBlocksPlain(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => {
      if (!b || typeof b !== 'object') return '';
      const o = b as Loose;
      if (typeof o.code === 'string') return o.code;
      if (typeof o.content === 'string') return o.content;
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function thinkingPlain(thinking: unknown): string {
  if (thinking == null) return '';
  if (typeof thinking === 'string') return thinking;
  if (typeof thinking === 'object' && typeof (thinking as Loose).text === 'string') {
    return (thinking as Loose).text as string;
  }
  return '';
}

function thinkingBlocksPlain(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => {
      if (!b || typeof b !== 'object') return '';
      const t = (b as Loose).text ?? (b as Loose).content;
      return typeof t === 'string' ? t : '';
    })
    .filter(Boolean)
    .join('\n');
}

export function bubbleText(bubble: BubblePayload | Loose | null | undefined): string {
  if (!bubble) return '';

  const parts: string[] = [];
  const b = bubble as Loose;

  if (typeof b.text === 'string' && b.text.trim()) parts.push(b.text);

  const fromRich = richTextPlain(b.richText);
  if (fromRich.trim() && !parts.join('\n').includes(fromRich.trim().slice(0, 40))) {
    parts.push(fromRich);
  }

  const fromThink = thinkingPlain(b.thinking);
  if (fromThink.trim()) parts.push(fromThink);

  const fromBlocks = thinkingBlocksPlain(b.allThinkingBlocks);
  if (fromBlocks.trim()) parts.push(fromBlocks);

  const fromTool = formatToolFormer(b.toolFormerData);
  if (fromTool.trim()) parts.push(fromTool);

  const fromCode = codeBlocksPlain(b.codeBlocks);
  if (fromCode.trim()) parts.push(fromCode);

  return parts.join('\n').trim();
}
