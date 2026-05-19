import { bubbleText } from './bubble-text';
import type { BubblePayload, ComposerData } from './types';

const DONE_TOOL = new Set(['completed', 'error', 'cancelled']);

function bubbleInProgress(bubble: BubblePayload | null | undefined): boolean {
  if (!bubble) return true;
  const toolSt = bubble.toolFormerData?.status;
  if (toolSt && !DONE_TOOL.has(toolSt)) return true;
  if (bubbleText(bubble)) return false;
  if (bubble.thinking || bubble.allThinkingBlocks?.length) return true;
  return true;
}

export function isAgentBusy(data: ComposerData | null | undefined): boolean {
  if (!data) return false;
  if (data.generatingBubbleIds?.length) return true;
  if (data.isContinuationInProgress) return true;
  if (Array.isArray(data.queueItems) && data.queueItems.length > 0) return true;
  const st = data.status;
  if (st === 'generating' || st === 'running') return true;

  const headers = data.fullConversationHeadersOnly;
  if (!headers?.length) return false;
  const map = data.conversationMap ?? {};
  const last = headers[headers.length - 1];
  if (last.type === 1) {
    return st !== 'completed' && st !== 'aborted' && st !== undefined;
  }
  if (last.type === 2 && (st === 'generating' || data.isContinuationInProgress)) {
    return bubbleInProgress(map[last.bubbleId]);
  }
  for (const h of headers.slice(-6)) {
    const toolSt = map[h.bubbleId]?.toolFormerData?.status;
    if (toolSt && !DONE_TOOL.has(toolSt)) return true;
  }
  return false;
}
