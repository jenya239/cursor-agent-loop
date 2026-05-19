export function isEmbeddedInCursor(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
