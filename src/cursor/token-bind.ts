const binds = new Map<string, string>();

export function bindAgentToken(token: string, composerId: string): void {
  if (!token || !composerId) return;
  binds.set(token, composerId);
}

export function resolveBoundComposer(token: string): string | null {
  return binds.get(token) ?? null;
}

export function clearTokenBind(token: string): void {
  binds.delete(token);
}

export function clearAllTokenBinds(): void {
  binds.clear();
}
