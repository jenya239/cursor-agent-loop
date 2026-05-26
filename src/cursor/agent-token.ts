import crypto from 'crypto';

export const TOKEN_PREFIX = 'cr-agent-';
export const TOKEN_KIND = 'cr-agent-token';
export const TOKEN_VERSION = 1;

export function generateAgentToken(rng: () => string = () => crypto.randomUUID()): string {
  return `${TOKEN_PREFIX}${rng()}`;
}

export function isValidAgentToken(token: string): boolean {
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  const rest = token.slice(TOKEN_PREFIX.length);
  return /^[0-9a-f-]{36}$/i.test(rest);
}

export function registerTokenPayload(token: string): {
  token: string;
  kind: string;
  v: number;
  hint: string;
} {
  return {
    token,
    kind: TOKEN_KIND,
    v: TOKEN_VERSION,
    hint: 'call cursor_agent_resolve on next message after this result is in chat history',
  };
}

export const REGISTER_TOOL_NAME = 'cursor_agent_register';

export function tokenFromRegisterToolResult(result: string | undefined): string | null {
  if (!result) return null;
  try {
    const o = JSON.parse(result) as { token?: unknown; kind?: unknown };
    if (typeof o.token !== 'string' || o.kind !== TOKEN_KIND) return null;
    return isValidAgentToken(o.token) ? o.token : null;
  } catch {
    return null;
  }
}
