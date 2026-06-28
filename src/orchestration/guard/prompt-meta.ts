import type { AgentRole } from '../types';

export interface PromptMeta {
  role?: AgentRole;
  step?: string;
  instructionsRev?: string;
  trackFile?: string;
}

export function parseAgentPrompt(text: string): PromptMeta {
  const role = text.match(/^ROLE=(\w+)/m)?.[1] as AgentRole | undefined;
  const step = text.match(/^STEP=(\S+)/m)?.[1];
  const instructionsRev = text.match(/^INSTRUCTIONS_REV=(\S+)/m)?.[1];
  const trackFile = text.match(/@docs\/agent\/(TRACK_\w+\.md)/m)?.[1];
  return { role, step, instructionsRev, trackFile };
}

export function promptKey(meta: PromptMeta): string {
  const track = meta.trackFile ? `:${meta.trackFile.replace('TRACK_', '').replace('.md', '')}` : '';
  return `${meta.role ?? '?'}:${meta.step ?? '?'}${track}`;
}

export function lastUserPromptKey(messages: { role: string; text: string }[]): string | null {
  const users = messages.filter((m) => m.role === 'user');
  for (let i = users.length - 1; i >= 0; i--) {
    const meta = parseAgentPrompt(users[i].text);
    if (meta.role && meta.step) return promptKey(meta);
  }
  return null;
}

export function countRecentSameKey(
  messages: { role: string; text: string }[],
  key: string,
  tail = 8
): number {
  return messages
    .filter((m) => m.role === 'user')
    .slice(-tail)
    .filter((m) => promptKey(parseAgentPrompt(m.text)) === key).length;
}
